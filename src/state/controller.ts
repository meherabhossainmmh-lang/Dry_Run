import { useArmStore } from './store';
import type { MotionCommand, Source } from '../core/commands';
import type { Vec3 } from '../core/math';
import { validate, poseOk } from '../core/validate';
import { clampToFloor } from '../core/floor';
import { stepToward } from '../core/executor';
import { solveIK, cartesianStep } from '../core/ik';
import { fk } from '../core/fk';
import { CHAIN, NJ, HOME } from '../core/chain';
import { clamp, add, sub, norm, scale } from '../core/math';

export interface DispatchResult {
  ok: boolean;
  reason: string;
}

const JOG_RATE = 0.9;       // rad/s — continuous joint jog (× gear)
const MOVE_VMAX = 1.2;      // rad/s — eased discrete moves (not geared)
const CART_RATE = 0.16;     // m/s — continuous Cartesian jog at full deflection (× gear)
const DQ_CAP_FRAME = 0.05;  // rad — per-frame joint-step cap (× gear, hard-ceiling'd)
const DQ_CAP_MAX = 0.15;    // rad — absolute per-frame ceiling, keeps Turbo safe near singularities
const CART_TAU = 0.025;     // s — velocity-smoothing time constant (ramps start, stops < 100 ms)
const CART_STOP_EPS = 0.02; // below 2 % of full speed the tip is considered at rest

/** Manual-jog speed gears — a multiplier on the jog rates, chosen from the UI or [ ] keys. */
export const JOG_GEARS: { label: string; mult: number }[] = [
  { label: 'Fine', mult: 0.35 },
  { label: 'Normal', mult: 1 },
  { label: 'Fast', mult: 2.5 },
  { label: 'Turbo', mult: 5 },
];

/**
 * The single motion pipeline. Three lanes, all writing store.q (the one source
 * of truth the renderer follows) and all limit-clamped:
 *   • joint jog  — per-joint velocity, integrated each frame
 *   • Cartesian jog — resolved-rate DLS from current q each frame
 *   • discrete commands — validate() then IK/ease toward a target pose
 * No source gets a privileged path; the agent will use this same surface.
 */
class MotionController {
  private held = new Map<number, number>();      // joint index → sign (+1 / −1)
  private cartHeld = new Map<string, Vec3>();    // jog id → base-frame direction (magnitude 0..1)
  private cartVel: Vec3 = [0, 0, 0];             // smoothed tip-velocity direction (eased toward held)
  private target: number[] | null = null;
  private lastSource: Source = 'dashboard';      // whose jog is running — for the event log
  private contact = false;                       // arm is currently resting on the surface

  /** Continuous joint jog (keyboard/joystick hold). */
  beginJog(joint: number, sign: number, source: Source) {
    if (joint < 0 || joint >= NJ) return;
    const fresh = !this.held.has(joint);
    this.held.set(joint, Math.sign(sign));
    this.target = null;
    this.lastSource = source;
    if (fresh)
      useArmStore.getState().log(source, `jog ${CHAIN[joint].label} ${sign > 0 ? '+' : '−'}`);
  }
  endJog(joint: number) {
    this.held.delete(joint);
  }

  /** Continuous Cartesian (tip) jog — resolved-rate. */
  beginCartJog(id: string, dir: Vec3, source: Source) {
    const fresh = !this.cartHeld.has(id);
    this.cartHeld.set(id, dir);
    this.target = null;
    this.lastSource = source;
    if (fresh) useArmStore.getState().log(source, `jog tip ${id}`);
  }
  endCartJog(id: string) {
    this.cartHeld.delete(id);
  }

  /**
   * Dashboard slider — an absolute per-joint set, applied immediately so the arm
   * tracks the thumb. Like the joystick it is a *continuous manual* control, so
   * it slides to contact on the surface rather than refusing outright; the
   * slider then snaps back to the pose the arm actually reached.
   */
  setJoint(joint: number, angle: number, source: Source) {
    if (joint < 0 || joint >= NJ) return;
    const j = CHAIN[joint];
    const q = useArmStore.getState().q.slice();
    q[joint] = clamp(angle, j.lower, j.upper);
    this.lastSource = source;
    this.target = null; // a dragged slider wins over any in-flight eased move
    this.commit(q);
  }

  /**
   * The one place a motion lane writes q. The surface is solid matter, so the
   * step is slid to contact rather than through: the arm comes to rest flush on
   * the floor. Returns true when the surface took part of the step away.
   */
  private commit(qNext: number[]): boolean {
    const st = useArmStore.getState();
    const safe = clampToFloor(st.q, qNext);
    let blocked = false;
    for (let i = 0; i < NJ; i++)
      if (Math.abs(safe[i] - qNext[i]) > 1e-9) { blocked = true; break; }
    st.setQ(safe);
    if (blocked && !this.contact) {
      this.contact = true;
      st.log(this.lastSource, 'blocked — the arm is resting on the surface', 'warn');
    } else if (!blocked && this.contact) {
      this.contact = false;
    }
    return blocked;
  }

  /** Release every held jog (focus loss / e-stop of the manual lanes).
   *  Zeroing cartVel makes 'stop' a hard e-stop; plain jog-release decays smoothly. */
  releaseAll() {
    this.held.clear();
    this.cartHeld.clear();
    this.cartVel = [0, 0, 0];
  }

  /** Run a discrete, validated command through the shared gate. */
  dispatch(cmd: MotionCommand): DispatchResult {
    const st = useArmStore.getState();
    this.lastSource = cmd.source;
    const res = validate(cmd, st.q);
    if (!res.ok) {
      st.log(cmd.source, `rejected ${cmd.type}: ${res.reason}`, 'warn');
      return { ok: false, reason: res.reason };
    }
    switch (cmd.type) {
      case 'stop':
        this.releaseAll();
        this.target = null;
        st.log(cmd.source, 'stop');
        return { ok: true, reason: 'stopped' };
      case 'home':
        this.target = HOME.slice();
        st.log(cmd.source, 'home → all joints 0');
        return { ok: true, reason: 'homing' };
      case 'rotateJoint': {
        const t = st.q.slice();
        t[cmd.joint] = cmd.toRad ?? st.q[cmd.joint] + (cmd.deltaRad ?? 0);
        this.target = t;
        const deg = `${((t[cmd.joint] * 180) / Math.PI).toFixed(0)}°`;
        st.log(cmd.source, `${CHAIN[cmd.joint].label} → ${deg}`);
        return { ok: true, reason: `${CHAIN[cmd.joint].label} → ${deg}` };
      }
      case 'jogJoint': {
        const t = st.q.slice();
        t[cmd.joint] = clamp(st.q[cmd.joint] + cmd.deltaRad, CHAIN[cmd.joint].lower, CHAIN[cmd.joint].upper);
        this.target = t;
        return { ok: true, reason: 'jog' };
      }
      case 'jog': {
        // Discrete Cartesian nudge (voice "move up 2 cm"): ease toward the
        // current tip + delta via IK, same eased-target lane as moveTo.
        const target = add(fk(st.q), cmd.delta);
        const sol = solveIK(target, { seed: st.q });
        if (!sol.ok) {
          const reason = `jog did not converge (${(sol.posErr * 1000).toFixed(0)} mm off)`;
          st.log(cmd.source, reason, 'warn');
          return { ok: false, reason };
        }
        // The target point clears the floor, but the pose IK found for it may not.
        const floor = poseOk(sol.q);
        if (!floor.ok) {
          st.log(cmd.source, `rejected jog: ${floor.reason}`, 'warn');
          return { ok: false, reason: floor.reason };
        }
        this.target = sol.q;
        const cm = Math.round(Math.max(...cmd.delta.map(Math.abs)) * 100);
        const reason = `jog ${cm} cm — IK residual ${(sol.posErr * 1000).toFixed(1)} mm`;
        st.log(cmd.source, reason);
        return { ok: true, reason };
      }
      case 'moveTo': {
        const sol = solveIK(cmd.xyz, { tipDown: cmd.tipDown ?? false, seed: st.q });
        if (!sol.ok) {
          const reason = `no IK solution — closest ${(sol.posErr * 1000).toFixed(0)} mm off`;
          st.log(cmd.source, `moveTo ${reason}`, 'warn');
          return { ok: false, reason };
        }
        const floor = poseOk(sol.q);
        if (!floor.ok) {
          st.log(cmd.source, `rejected moveTo: ${floor.reason}`, 'warn');
          return { ok: false, reason: floor.reason };
        }
        this.target = sol.q;
        const mm = cmd.xyz.map((v) => (v * 1000).toFixed(0)).join(', ');
        const reason = `solved — IK residual ${(sol.posErr * 1000).toFixed(1)} mm`;
        st.log(cmd.source, `moveTo (${mm}) mm — IK ${(sol.posErr * 1000).toFixed(1)} mm`);
        return { ok: true, reason };
      }
      default:
        // touchKey / typePin — the PIN state machine (Step 5).
        st.log(cmd.source, `${cmd.type} arrives with the PIN sequence`, 'warn');
        return { ok: false, reason: `${cmd.type} runs via the PIN pad` };
    }
  }

  /** Advance motion by dt seconds. Called from the render frame loop. */
  tick(dt: number) {
    const st = useArmStore.getState();
    const gear = JOG_GEARS[st.gear]?.mult ?? 1; // manual-jog speed multiplier
    const cartRate = CART_RATE * gear;
    const dqCap = Math.min(DQ_CAP_MAX, DQ_CAP_FRAME * gear);

    // Cartesian lane — commanded direction is the sum of held jogs (proportional:
    // a partly-deflected joystick summing to < 1 jogs slower). The applied velocity
    // eases toward it (CART_TAU) so starts and stops are smooth rather than stepped,
    // and the lane keeps ticking after release until the residual velocity decays out.
    let cmd: Vec3 = [0, 0, 0];
    for (const v of this.cartHeld.values()) cmd = add(cmd, v);
    const cmdN = norm(cmd);
    if (cmdN > 1) cmd = scale(cmd, 1 / cmdN); // full deflection caps the speed; below that scales down
    const a = Math.min(1, dt / CART_TAU);
    this.cartVel = add(this.cartVel, scale(sub(cmd, this.cartVel), a));
    const speed = norm(this.cartVel);
    if (this.cartHeld.size > 0 || speed > CART_STOP_EPS) {
      if (speed > 1e-4) {
        const dxyz = scale(this.cartVel, cartRate * dt);
        const dq = cartesianStep(st.q, dxyz);
        let maxAbs = 0;
        for (const v of dq) maxAbs = Math.max(maxAbs, Math.abs(v));
        const sc = maxAbs > dqCap ? dqCap / maxAbs : 1;
        const q = st.q.slice();
        for (let i = 0; i < NJ; i++)
          q[i] = clamp(q[i] + dq[i] * sc, CHAIN[i].lower, CHAIN[i].upper);
        // Jogging into the surface parks the arm on it; kill the smoothed
        // velocity so it doesn't keep integrating against a solid plane.
        if (this.commit(q)) this.cartVel = [0, 0, 0];
      } else {
        this.cartVel = [0, 0, 0];
      }
      if (this.cartHeld.size > 0) this.target = null;
      return;
    }

    if (this.held.size > 0) {
      const q = st.q.slice();
      for (const [j, sign] of this.held)
        q[j] = clamp(q[j] + sign * JOG_RATE * gear * dt, CHAIN[j].lower, CHAIN[j].upper);
      this.target = null;
      this.commit(q);
      return;
    }

    if (this.target) {
      const { q, done } = stepToward(st.q, this.target, MOVE_VMAX * dt);
      // Joint-space interpolation isn't a straight line in Cartesian space, so an
      // eased move between two legal poses can still swing a link under the
      // surface. Stop there rather than tunnel through.
      if (this.commit(q)) this.target = null;
      else if (done) this.target = null;
    }
  }

  get busy(): boolean {
    return this.held.size > 0 || this.cartHeld.size > 0 || this.target !== null;
  }
}

export const motion = new MotionController();
