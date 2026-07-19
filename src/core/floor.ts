/**
 * The surface is solid matter.
 *
 * The base plane isn't a backdrop the arm may sink through — no part of the arm
 * may ever go below it. This module owns that one rule so every lane enforces
 * the same thing:
 *   • validate()    — rejects a command whose resulting pose would breach it
 *   • MotionController.tick() — slides a continuous jog to contact and stops
 *
 * Model: the movable arm is the polyline joint-1 origin → … → stylus tip. Its
 * links are straight segments and the surface is the plane z = FLOOR_Z, so the
 * minimum height over the polyline's vertices IS the minimum over the whole arm
 * — there is no need to sample along the links.
 *
 * The pedestal below joint 1 is excluded: it is fixed structure standing *on*
 * the surface (its foot is at z = 0 by definition), not a part that can move
 * through it.
 */
import type { Vec3 } from './math';
import { getTranslation } from './math';
import { fkFrames } from './fk';
import { CHAIN, NJ, FLOOR_Z } from './chain';

export interface LowPoint {
  /** Height of the lowest point of the arm, in meters. */
  z: number;
  /** Which part of the arm is lowest — used to explain a rejection. */
  link: string;
}

/** Every vertex of the movable arm polyline, in world (base-frame) coordinates. */
export function armPoints(q: number[]): { p: Vec3; link: string }[] {
  const { frames, tip } = fkFrames(q);
  const pts: { p: Vec3; link: string }[] = [];
  for (let i = 0; i < NJ; i++) pts.push({ p: getTranslation(frames[i]), link: CHAIN[i].label });
  pts.push({ p: getTranslation(tip), link: 'stylus tip' });
  return pts;
}

/** The lowest point of the arm at pose q, and which part of it that is. */
export function lowestPoint(q: number[]): LowPoint {
  let best: LowPoint = { z: Infinity, link: 'stylus tip' };
  for (const { p, link } of armPoints(q)) if (p[2] < best.z) best = { z: p[2], link };
  return best;
}

/** True when any part of the arm at pose q is below the surface. */
export function belowFloor(q: number[]): boolean {
  return lowestPoint(q).z < FLOOR_Z;
}

/**
 * Slide-to-contact. Returns the furthest point along the step q0 → q1 that keeps
 * the whole arm above the surface, so a jog held into the floor comes to rest
 * flush against it rather than passing through or stopping short.
 *
 * `q0` is assumed legal (it is the pose already on screen). Per-frame steps are
 * small, so legality is a prefix of [0,1] and a bisection finds the contact
 * point. If even the first increment breaches the floor this returns `q0` — the
 * arm simply doesn't move.
 */
export function clampToFloor(q0: number[], q1: number[]): number[] {
  if (!belowFloor(q1)) return q1;
  const lerp = (t: number) => q0.map((v, i) => v + (q1[i] - v) * t);
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 12; k++) {
    const mid = (lo + hi) / 2;
    if (belowFloor(lerp(mid))) hi = mid;
    else lo = mid;
  }
  return lerp(lo);
}
