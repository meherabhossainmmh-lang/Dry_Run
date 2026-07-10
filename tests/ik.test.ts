import { describe, it, expect } from 'vitest';
import { solveIK, precomputeKeyPoses } from '../src/core/ik';
import { fk } from '../src/core/fk';
import { KEY_POINTS, KEY_HOVER } from '../src/core/keys';
import { dist } from '../src/core/math';
import { CHAIN } from '../src/core/chain';

const withinLimits = (q: number[]) =>
  q.every((v, i) => v >= CHAIN[i].lower - 1e-6 && v <= CHAIN[i].upper + 1e-6);

describe('damped-least-squares IK', () => {
  it('reaches hover + touch for all 6 keys within 1 mm, tip-down', () => {
    for (const d of [1, 2, 3, 4, 5, 6] as const) {
      const k = KEY_POINTS[d];
      const hoverTarget: [number, number, number] = [k[0], k[1], k[2] + KEY_HOVER];
      const hover = solveIK(hoverTarget, { tipDown: true });
      expect(hover.ok, `key ${d} hover ok`).toBe(true);
      expect(dist(fk(hover.q), hoverTarget)).toBeLessThan(0.001);

      const touch = solveIK(k, { tipDown: true, seed: hover.q });
      expect(touch.ok, `key ${d} touch ok`).toBe(true);
      expect(dist(fk(touch.q), k)).toBeLessThan(0.001);
      expect(withinLimits(touch.q), `key ${d} within limits`).toBe(true);
    }
  });

  it('precomputeKeyPoses marks every key reachable', () => {
    const poses = precomputeKeyPoses();
    for (const d of [1, 2, 3, 4, 5, 6] as const) {
      expect(poses[d].reachable, `key ${d} reachable`).toBe(true);
      expect(poses[d].touchErr).toBeLessThan(0.001);
    }
  });

  it('converges on a grid of reachable targets', () => {
    let solved = 0, total = 0;
    for (const x of [0.4, 0.5, 0.6])
      for (const y of [-0.1, 0, 0.1])
        for (const z of [0.05, 0.15, 0.25]) {
          total++;
          const target: [number, number, number] = [x, y, z];
          const r = solveIK(target, { tipDown: false });
          if (r.ok) {
            solved++;
            expect(dist(fk(r.q), target)).toBeLessThan(0.0011);
          }
        }
    expect(solved / total).toBeGreaterThan(0.9);
  });

  it('never reports ok for an out-of-reach target', () => {
    expect(solveIK([2.5, 0, 1.0], { tipDown: false }).ok).toBe(false);
  });
});
