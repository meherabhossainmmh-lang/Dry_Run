import type { Vec3 } from './math';
import { cross, sub, getAxis, getTranslation } from './math';
import { fkFrames } from './fk';
import { CHAIN, NJ } from './chain';

export interface Jac {
  /** 6 × 7 geometric Jacobian. Rows: vx vy vz | wx wy wz (world frame). */
  J: number[][];
  /** Tip position (world). */
  p: Vec3;
  /** Tip pointing direction = stylus local +Z in world (the approach axis). */
  zAxis: Vec3;
}

/**
 * Analytic geometric Jacobian. For each revolute joint i with world axis aᵢ and
 * pivot oᵢ, the linear column is aᵢ × (p_tip − oᵢ) and the angular column is aᵢ.
 */
export function geometricJacobian(q: number[]): Jac {
  const { frames, tip } = fkFrames(q);
  const p = getTranslation(tip);
  const zAxis = getAxis(tip, 'Z');
  const J: number[][] = [[], [], [], [], [], []];
  for (let i = 0; i < NJ; i++) {
    const a = getAxis(frames[i], CHAIN[i].axis);
    const o = getTranslation(frames[i]);
    const jv = cross(a, sub(p, o));
    J[0].push(jv[0]); J[1].push(jv[1]); J[2].push(jv[2]);
    J[3].push(a[0]);  J[4].push(a[1]);  J[5].push(a[2]);
  }
  return { J, p, zAxis };
}
