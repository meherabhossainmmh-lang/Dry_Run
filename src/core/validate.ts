import type { MotionCommand, Digit } from './commands';
import type { Vec3 } from './math';
import { add, dist, clamp } from './math';
import { fk } from './fk';
import { lowestPoint } from './floor';
import { CHAIN, NJ, HOME, SHOULDER, MAX_REACH, REACH_SAFETY, FLOOR_Z } from './chain';
import { KEY_POINTS } from './keys';

export type ValidateResult = { ok: true } | { ok: false; reason: string };

const OK: ValidateResult = { ok: true };
const deg = (r: number) => ((r * 180) / Math.PI).toFixed(0);
const mm = (m: number) => (m * 1000).toFixed(0);

function jointIndexOk(i: number): ValidateResult {
  return Number.isInteger(i) && i >= 0 && i < NJ
    ? OK
    : { ok: false, reason: `joint index ${i} out of range 0–${NJ - 1}` };
}

function angleOk(i: number, angle: number): ValidateResult {
  const idx = jointIndexOk(i);
  if (!idx.ok) return idx;
  const j = CHAIN[i];
  if (angle < j.lower - 1e-6 || angle > j.upper + 1e-6)
    return { ok: false, reason: `${j.label} → ${deg(angle)}° exceeds limit [${deg(j.lower)}°, ${deg(j.upper)}°]` };
  return OK;
}

function reachOk(p: Vec3): ValidateResult {
  if (p[2] < FLOOR_Z)
    return { ok: false, reason: `target z ${mm(p[2])} mm is below the floor (${mm(FLOOR_Z)} mm)` };
  const r = dist(p, SHOULDER);
  const limit = REACH_SAFETY * MAX_REACH;
  if (r > limit)
    return { ok: false, reason: `target ${mm(r)} mm from shoulder is beyond reach (${mm(limit)} mm)` };
  return OK;
}

/**
 * The surface is solid — reject any pose that would put *any* part of the arm
 * (not just the tip) below it. Exported so the motion lanes and the IK-solution
 * check apply the identical rule.
 */
export function poseOk(q: number[]): ValidateResult {
  const low = lowestPoint(q);
  if (low.z < FLOOR_Z)
    return {
      ok: false,
      reason: `${low.link} would reach ${mm(low.z)} mm — the surface is solid (min ${mm(FLOOR_Z)} mm)`,
    };
  return OK;
}

/** Pose the arm lands in after a single-joint command, for the floor check. */
function poseWithJoint(q: number[], joint: number, angle: number): number[] {
  const t = q.slice();
  t[joint] = angle;
  return t;
}

/** The one deterministic gate every input source passes through. */
export function validate(cmd: MotionCommand, q: number[]): ValidateResult {
  switch (cmd.type) {
    case 'stop':
      return OK;
    case 'home':
      return poseOk(HOME);
    case 'jogJoint': {
      const idx = jointIndexOk(cmd.joint);
      if (!idx.ok) return idx;
      const j = CHAIN[cmd.joint];
      // The controller clamps the jog step into the joint's range, so validate
      // the pose it will actually land in rather than the raw request.
      const target = clamp(q[cmd.joint] + cmd.deltaRad, j.lower, j.upper);
      return poseOk(poseWithJoint(q, cmd.joint, target));
    }
    case 'rotateJoint': {
      const idx = jointIndexOk(cmd.joint);
      if (!idx.ok) return idx;
      const target = cmd.toRad ?? q[cmd.joint] + (cmd.deltaRad ?? 0);
      const ang = angleOk(cmd.joint, target);
      if (!ang.ok) return ang;
      return poseOk(poseWithJoint(q, cmd.joint, target));
    }
    case 'jog':
      return reachOk(add(fk(q), cmd.delta));
    case 'moveTo':
      return reachOk(cmd.xyz);
    case 'touchKey':
      return KEY_POINTS[cmd.key] ? reachOk(KEY_POINTS[cmd.key]) : { ok: false, reason: `no key ${cmd.key}` };
    case 'typePin': {
      if (!/^[1-6]+$/.test(cmd.pin)) return { ok: false, reason: `PIN "${cmd.pin}" must be digits 1–6` };
      for (const ch of cmd.pin) {
        const r = reachOk(KEY_POINTS[Number(ch) as Digit]);
        if (!r.ok) return r;
      }
      return OK;
    }
  }
}
