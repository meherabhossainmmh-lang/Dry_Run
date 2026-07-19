import { describe, it, expect } from 'vitest';
import { lowestPoint, belowFloor, clampToFloor, armPoints } from '../src/core/floor';
import { validate } from '../src/core/validate';
import { precomputeKeyPoses } from '../src/core/ik';
import { HOME, FLOOR_Z, NJ, CHAIN } from '../src/core/chain';
import type { Digit } from '../src/core/commands';

/** Shoulder driven to its lower joint limit — legal for the joint, illegal for the arm. */
const SHOULDER_DOWN = [0, CHAIN[1].lower, 0, 0, 0, 0, 0];

describe('floor — the surface is solid matter', () => {
  it('models the movable arm as 7 joint origins + the tip (no pedestal vertex)', () => {
    const pts = armPoints(HOME);
    expect(pts).toHaveLength(NJ + 1);
    expect(pts.at(-1)!.link).toBe('stylus tip');
    // The pedestal foot at z=0 must NOT be a vertex, or every pose would breach.
    expect(pts.every((v) => v.p[2] > 0)).toBe(true);
  });

  it('home is clear of the surface — lowest part is joint 1 at 60 mm', () => {
    const low = lowestPoint(HOME);
    expect(low.z).toBeCloseTo(0.06, 6);
    expect(belowFloor(HOME)).toBe(false);
  });

  it('detects a link below the surface even when the joint itself is in range', () => {
    // The shoulder limit (−120°) is a legal *joint* angle, but it swings the
    // wrist under the table. Joint limits alone never caught this.
    expect(CHAIN[1].lower).toBeLessThanOrEqual(SHOULDER_DOWN[1]);
    expect(belowFloor(SHOULDER_DOWN)).toBe(true);
    expect(lowestPoint(SHOULDER_DOWN).z).toBeLessThan(0);
  });

  it('names the offending link so a rejection can explain itself', () => {
    const low = lowestPoint(SHOULDER_DOWN);
    expect(low.link).not.toBe('base');
    expect(low.link.length).toBeGreaterThan(0);
  });

  describe('clampToFloor — slide to contact', () => {
    it('passes a legal step through untouched', () => {
      const q1 = [0.3, -0.2, 0.1, 0, 0, 0, 0];
      expect(clampToFloor(HOME, q1)).toEqual(q1);
    });

    it('stops a floor-breaching step at the surface, not through it', () => {
      const safe = clampToFloor(HOME, SHOULDER_DOWN);
      expect(belowFloor(safe)).toBe(false);
      // It should get close to the surface, not bail out at the start pose.
      expect(lowestPoint(safe).z).toBeLessThan(0.05);
      expect(lowestPoint(safe).z).toBeGreaterThanOrEqual(FLOOR_Z - 1e-6);
      // …and it should have travelled a real distance along the step.
      expect(Math.abs(safe[1] - HOME[1])).toBeGreaterThan(0.5);
      expect(Math.abs(safe[1])).toBeLessThan(Math.abs(SHOULDER_DOWN[1]));
    });

    it('is idempotent — clamping an already-clamped step moves nothing further', () => {
      const safe = clampToFloor(HOME, SHOULDER_DOWN);
      expect(clampToFloor(safe, safe)).toEqual(safe);
    });
  });

  describe('validate — the gate rejects floor-breaching commands', () => {
    it('rejects a rotateJoint that is within joint limits but drives a link under', () => {
      const res = validate(
        { type: 'rotateJoint', joint: 1, toRad: CHAIN[1].lower, source: 'voice' },
        HOME,
      );
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toMatch(/surface is solid/);
    });

    it('rejects a jogJoint step that would breach the surface', () => {
      const nearFloor = clampToFloor(HOME, SHOULDER_DOWN);
      const res = validate(
        { type: 'jogJoint', joint: 1, deltaRad: -0.5, source: 'joystick' },
        nearFloor,
      );
      expect(res.ok).toBe(false);
    });

    it('still passes a rotateJoint that keeps the whole arm clear', () => {
      expect(validate({ type: 'rotateJoint', joint: 0, toRad: 1.0, source: 'voice' }, HOME).ok).toBe(true);
      expect(validate({ type: 'rotateJoint', joint: 1, toRad: -1.0, source: 'voice' }, HOME).ok).toBe(true);
    });

    it('passes home (the zero pose stands clear of the surface)', () => {
      expect(validate({ type: 'home', source: 'voice' }, SHOULDER_DOWN).ok).toBe(true);
    });
  });

  it('every autonomous PIN pose keeps the whole arm above the surface', () => {
    const poses = precomputeKeyPoses();
    for (const d of [1, 2, 3, 4, 5, 6] as Digit[]) {
      const { hover, touch, reachable } = poses[d];
      expect(reachable).toBe(true);
      expect(belowFloor(hover), `key ${d} hover`).toBe(false);
      expect(belowFloor(touch), `key ${d} touch`).toBe(false);
    }
  });
});
