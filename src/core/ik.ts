import type { Vec3 } from './math';
import type { Digit } from './commands';
import { cross, sub, norm, clamp, solveLinear } from './math';
import { geometricJacobian } from './jacobian';
import { CHAIN, NJ } from './chain';
import { KEY_POINTS, KEY_HOVER } from './keys';

const LAMBDA2 = 0.08 * 0.08; // DLS damping λ²
const DQ_CAP = 0.2;          // max |Δq| per joint per iter (rad)
const KW = 0.5;              // tip-down orientation task weight
export const POS_TOL = 0.001; // 1 mm convergence
const ORI_TOL = 0.06;         // ~3.4° pointing tolerance
const MAX_ITERS = 120;
const Z_DES: Vec3 = [0, 0, -1]; // desired stylus pointing = straight down

/** Forward-and-down ready pose — the primary IK seed / joystick home. */
export const Q_READY: number[] = [0, 1.15, 0.75, 0, 0.95, 0, 0.45];

// Fallback seeds tried in order if the current pose doesn't converge.
const SEEDS: number[][] = [
  Q_READY,
  [0, 1.45, 0.55, 0, 1.15, 0, 0.35],
  [0, 0.85, 1.15, 0, 0.80, 0, 0.50],
  [0, 1.25, 0.95, 0, 1.30, 0, 0.30],
];

export interface IkOptions {
  tipDown?: boolean;
  seed?: number[];
}

export interface IkResult {
  q: number[];
  ok: boolean;
  posErr: number; // meters
  oriErr: number; // sin of pointing error
  iters: number;
}

function solveFrom(target: Vec3, seed: number[], tipDown: boolean): IkResult {
  const q = seed.slice();
  let posErr = Infinity, oriErr = Infinity, iters = 0;
  for (iters = 0; iters < MAX_ITERS; iters++) {
    const { J, p, zAxis } = geometricJacobian(q);
    const ep = sub(target, p);
    posErr = norm(ep);
    const eo: Vec3 = tipDown ? cross(zAxis, Z_DES) : [0, 0, 0];
    oriErr = tipDown ? norm(eo) : 0;
    if (posErr < POS_TOL && oriErr < ORI_TOL) break;

    const rows = tipDown ? 6 : 3;
    // Weighted Jacobian rows + weighted task error (orientation rows × KW).
    const Jw: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const w = r >= 3 ? KW : 1;
      Jw.push(J[r].map((v) => v * w));
    }
    const e = [ep[0], ep[1], ep[2]];
    if (tipDown) e.push(eo[0] * KW, eo[1] * KW, eo[2] * KW);

    // DLS: dq = Jwᵀ (Jw Jwᵀ + λ²I)⁻¹ e
    const A: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const row = new Array<number>(rows).fill(0);
      for (let c = 0; c < rows; c++) {
        let s = 0;
        for (let i = 0; i < NJ; i++) s += Jw[r][i] * Jw[c][i];
        row[c] = s + (r === c ? LAMBDA2 : 0);
      }
      A.push(row);
    }
    const y = solveLinear(A, e);
    const dq = new Array<number>(NJ).fill(0);
    for (let i = 0; i < NJ; i++) {
      let s = 0;
      for (let r = 0; r < rows; r++) s += Jw[r][i] * y[r];
      dq[i] = s;
    }

    let maxAbs = 0;
    for (const v of dq) maxAbs = Math.max(maxAbs, Math.abs(v));
    const sc = maxAbs > DQ_CAP ? DQ_CAP / maxAbs : 1;
    for (let i = 0; i < NJ; i++)
      q[i] = clamp(q[i] + dq[i] * sc, CHAIN[i].lower, CHAIN[i].upper);
  }
  const ok = posErr < POS_TOL && oriErr < ORI_TOL;
  return { q, ok, posErr, oriErr, iters };
}

/** Solve IK for a base-frame target, trying the current seed then fallbacks. */
export function solveIK(target: Vec3, opts: IkOptions = {}): IkResult {
  const tipDown = opts.tipDown ?? false;
  const seeds = opts.seed ? [opts.seed, ...SEEDS] : SEEDS;
  let best: IkResult | null = null;
  for (const s of seeds) {
    const r = solveFrom(target, s, tipDown);
    if (r.ok) return r;
    if (!best || r.posErr < best.posErr) best = r;
  }
  return best as IkResult;
}

/**
 * One resolved-rate DLS step: joint deltas that move the tip by dxyz (position
 * only). Called per-frame for continuous Cartesian jog — no queued segments.
 */
export function cartesianStep(q: number[], dxyz: Vec3): number[] {
  const { J } = geometricJacobian(q);
  const Jv = [J[0], J[1], J[2]]; // 3 × 7 position block
  const A: number[][] = [];
  for (let r = 0; r < 3; r++) {
    const row = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let i = 0; i < NJ; i++) s += Jv[r][i] * Jv[c][i];
      row[c] = s + (r === c ? LAMBDA2 : 0);
    }
    A.push(row);
  }
  const y = solveLinear(A, [dxyz[0], dxyz[1], dxyz[2]]);
  const dq = new Array<number>(NJ).fill(0);
  for (let i = 0; i < NJ; i++) {
    let s = 0;
    for (let r = 0; r < 3; r++) s += Jv[r][i] * y[r];
    dq[i] = s;
  }
  return dq;
}

export interface KeyPose {
  key: Digit;
  hover: number[];
  touch: number[];
  reachable: boolean;
  touchErr: number; // meters
}

/**
 * Precompute hover + touch joint poses for all 6 keys once at startup. This is
 * the PIN safety net: even if live IK is disabled, the sequence runs from these.
 */
export function precomputeKeyPoses(): Record<Digit, KeyPose> {
  const out = {} as Record<Digit, KeyPose>;
  for (const d of [1, 2, 3, 4, 5, 6] as Digit[]) {
    const k = KEY_POINTS[d];
    const hover = solveIK([k[0], k[1], k[2] + KEY_HOVER], { tipDown: true });
    const touch = solveIK([k[0], k[1], k[2]], { tipDown: true, seed: hover.q });
    out[d] = {
      key: d,
      hover: hover.q,
      touch: touch.q,
      reachable: hover.ok && touch.ok,
      touchErr: touch.posErr,
    };
  }
  return out;
}
