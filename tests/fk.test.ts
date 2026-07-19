import { describe, it, expect } from 'vitest';
import { fk, fkFrames } from '../src/core/fk';
import { CHAIN, NJ, MAX_REACH, SHOULDER } from '../src/core/chain';

const Z7 = [0, 0, 0, 0, 0, 0, 0];

describe('forward kinematics', () => {
  it('all-zero pose puts the tip at the FK anchor (0, 0, 1.497 m)', () => {
    const p = fk(Z7);
    expect(p[0]).toBeCloseTo(0, 9);
    expect(p[1]).toBeCloseTo(0, 9);
    expect(p[2]).toBeCloseTo(1.497, 9);
  });

  it('base yaw alone does not move a straight-up tip', () => {
    const p = fk([1.0, 0, 0, 0, 0, 0, 0]);
    expect(p[0]).toBeCloseTo(0, 9);
    expect(p[1]).toBeCloseTo(0, 9);
    expect(p[2]).toBeCloseTo(1.497, 9);
  });

  it('shoulder +90° swings the tip out along +X at shoulder height', () => {
    const distal = 1.497 - SHOULDER[2]; // 1.187 m of chain above the shoulder
    const p = fk([0, Math.PI / 2, 0, 0, 0, 0, 0]);
    expect(p[0]).toBeCloseTo(distal, 6);
    expect(p[1]).toBeCloseTo(0, 6);
    expect(p[2]).toBeCloseTo(SHOULDER[2], 6);
  });

  it('exposes one world frame per actuated joint', () => {
    expect(fkFrames(Z7).frames).toHaveLength(NJ);
    expect(CHAIN).toHaveLength(NJ);
  });

  it('max reach from the shoulder equals the summed distal link lengths (≈ 1.187 m)', () => {
    expect(MAX_REACH).toBeCloseTo(1.187, 6);
  });
});
