import type { Mat4, Vec3 } from './math';
import { IDENTITY, mul, translation, rotX, rotY, rotZ, getTranslation } from './math';
import { CHAIN, TIP_OFFSET, NJ } from './chain';
import type { Axis } from './chain';

function rot(axis: Axis, t: number): Mat4 {
  return axis === 'X' ? rotX(t) : axis === 'Y' ? rotY(t) : rotZ(t);
}

export interface FkResult {
  /** World transform of each joint frame, after that joint's own rotation (length 7). */
  frames: Mat4[];
  /** World transform of the stylus_tip TCP frame. */
  tip: Mat4;
}

/** Full forward-kinematic pass: per-joint world frames + the tip frame. */
export function fkFrames(q: number[]): FkResult {
  let T: Mat4 = IDENTITY;
  const frames: Mat4[] = [];
  for (let i = 0; i < NJ; i++) {
    const j = CHAIN[i];
    T = mul(T, translation(j.offset[0], j.offset[1], j.offset[2]));
    T = mul(T, rot(j.axis, q[i]));
    frames.push(T);
  }
  const tip = mul(T, translation(TIP_OFFSET[0], TIP_OFFSET[1], TIP_OFFSET[2]));
  return { frames, tip };
}

/** Stylus-tip position in the base frame (meters). */
export function fk(q: number[]): Vec3 {
  return getTranslation(fkFrames(q).tip);
}
