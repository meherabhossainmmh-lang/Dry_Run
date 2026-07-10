import { describe, it, expect } from 'vitest';
import { geometricJacobian } from '../src/core/jacobian';
import { fk } from '../src/core/fk';

// Central finite difference of the tip position w.r.t. joint i.
function fdColumn(q: number[], i: number, eps = 1e-6): [number, number, number] {
  const qp = q.slice(); qp[i] += eps;
  const qm = q.slice(); qm[i] -= eps;
  const pp = fk(qp), pm = fk(qm);
  return [(pp[0] - pm[0]) / (2 * eps), (pp[1] - pm[1]) / (2 * eps), (pp[2] - pm[2]) / (2 * eps)];
}

const POSES: number[][] = [
  [0, 0, 0, 0, 0, 0, 0],
  [0.3, 0.5, -0.4, 0.2, 0.6, -0.3, 0.4],
  [-0.5, 1.0, 0.8, 1.2, -0.7, 2.0, -0.5],
  [1.5, -1.2, 1.6, -2.0, 1.1, 0.5, 0.9],
];

describe('geometric Jacobian vs finite differences', () => {
  it('position rows match central FD across varied poses', () => {
    for (const q of POSES) {
      const { J } = geometricJacobian(q);
      for (let i = 0; i < 7; i++) {
        const fd = fdColumn(q, i);
        expect(J[0][i]).toBeCloseTo(fd[0], 5);
        expect(J[1][i]).toBeCloseTo(fd[1], 5);
        expect(J[2][i]).toBeCloseTo(fd[2], 5);
      }
    }
  });
});
