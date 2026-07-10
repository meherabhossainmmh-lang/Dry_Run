import { useArmStore } from './store';
import type { PinResult } from './store';
import { fk } from '../core/fk';
import { cartesianStep, precomputeKeyPoses } from '../core/ik';
import type { KeyPose } from '../core/ik';
import { stepToward } from '../core/executor';
import { CHAIN, NJ } from '../core/chain';
import { KEY_POINTS, KEY_HOVER } from '../core/keys';
import { clamp } from '../core/math';
import { parsePin, touchResult } from '../core/pin';
import type { Digit } from '../core/commands';

type Phase = 'idle' | 'transit' | 'settle' | 'descend' | 'dwell' | 'retract' | 'done';

const TRANSIT_VMAX = 1.6;   // rad/s — move to the hover pose
const DESC_RATE = 0.05;     // m/s — deliberate straight-down descent
const RETRACT_RATE = 0.10;  // m/s — lift back to hover
const SETTLE = 0.15;        // s — pause at hover before descending
const DWELL = 0.4;          // s — hold on the key (success is sampled here)
const Z_EPS = 0.0005;       // m — descent stop tolerance

/**
 * Autonomous PIN entry. Per digit: transit to a hover pose → settle → pure −Z
 * descent → dwell (sample success = FK of executed pose ≤ 5 mm) → retract. Runs
 * off the render frame loop, drives store.q, and publishes pinProgress for the
 * UI + key highlights. Uses the precomputed IK poses as the reachable safety net.
 */
class PinRunner {
  private poses: Record<Digit, KeyPose> | null = null;
  private pin: Digit[] = [];
  private index = 0;
  private phase: Phase = 'idle';
  private phaseT = 0;
  private results: PinResult[] = [];

  get active(): boolean {
    return this.phase !== 'idle' && this.phase !== 'done';
  }

  private ensurePoses(): Record<Digit, KeyPose> {
    if (!this.poses) this.poses = precomputeKeyPoses();
    return this.poses;
  }

  /** Precompute IK poses ahead of the demo so the first run has no hitch. */
  warmup() {
    this.ensurePoses();
  }

  start(pinStr: string): boolean {
    const pin = parsePin(pinStr);
    if (pin.length === 0) return false;
    this.ensurePoses();
    this.pin = pin;
    this.index = 0;
    this.results = [];
    this.phaseT = 0;
    this.phase = 'transit';
    useArmStore.getState().log('auto', `PIN run: ${pin.join('')} — ${pin.length} keys`);
    this.publish();
    return true;
  }

  abort() {
    if (!this.active) return;
    this.phase = 'idle';
    useArmStore.getState().log('auto', 'PIN aborted', 'warn');
    this.publish();
  }

  private toPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.publish();
  }

  private publish() {
    useArmStore.getState().setPinProgress({
      running: this.active,
      pin: this.pin.slice(),
      index: this.index,
      phase: this.phase,
      results: this.results.slice(),
    });
  }

  private advance() {
    this.index++;
    if (this.index >= this.pin.length) {
      const passed = this.results.filter((r) => r.ok).length;
      const all = passed === this.pin.length;
      useArmStore.getState().log('auto', `PIN complete: ${passed}/${this.pin.length} keys within 5 mm`, all ? 'info' : 'warn');
      this.toPhase('done');
    } else {
      this.toPhase('transit');
    }
  }

  tick(dt: number) {
    if (!this.active) return;
    const st = useArmStore.getState();
    const poses = this.ensurePoses();
    const key = this.pin[this.index];
    const kp = KEY_POINTS[key];
    const pose = poses[key];
    this.phaseT += dt;
    const q = st.q.slice();

    switch (this.phase) {
      case 'transit': {
        if (!pose.reachable) {
          this.results.push({ key, mm: Infinity, ok: false });
          st.log('auto', `key ${key} unreachable — marked fail`, 'error');
          this.advance();
          return;
        }
        const { q: nq, done } = stepToward(q, pose.hover, TRANSIT_VMAX * dt);
        st.setQ(nq);
        if (done) this.toPhase('settle');
        return;
      }
      case 'settle': {
        st.setQ(pose.hover);
        if (this.phaseT >= SETTLE) this.toPhase('descend');
        return;
      }
      case 'descend': {
        if (fk(q)[2] <= kp[2] + Z_EPS) {
          this.toPhase('dwell');
          return;
        }
        const dq = cartesianStep(q, [0, 0, -DESC_RATE * dt]);
        for (let i = 0; i < NJ; i++) q[i] = clamp(q[i] + dq[i], CHAIN[i].lower, CHAIN[i].upper);
        st.setQ(q);
        return;
      }
      case 'dwell': {
        if (this.phaseT >= DWELL) {
          const res = touchResult(fk(st.q), key);
          this.results.push({ key, ...res });
          st.log('auto', `key ${key}: ${res.mm.toFixed(1)} mm ${res.ok ? '✓ PASS' : '✗ FAIL'}`, res.ok ? 'info' : 'error');
          this.toPhase('retract');
        }
        return;
      }
      case 'retract': {
        if (fk(q)[2] >= kp[2] + KEY_HOVER - 0.001) {
          this.advance();
          return;
        }
        const dq = cartesianStep(q, [0, 0, RETRACT_RATE * dt]);
        for (let i = 0; i < NJ; i++) q[i] = clamp(q[i] + dq[i], CHAIN[i].lower, CHAIN[i].upper);
        st.setQ(q);
        return;
      }
    }
  }
}

export const pinRunner = new PinRunner();
