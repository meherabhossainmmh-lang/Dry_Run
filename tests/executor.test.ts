import { describe, it, expect } from 'vitest';
import { stepToward } from '../src/core/executor';

describe('stepToward', () => {
  it('caps each joint step and reports not-done mid-way', () => {
    const { q, done } = stepToward([0, 0, 0], [1, 0, 0], 0.1);
    expect(q[0]).toBeCloseTo(0.1, 9);
    expect(done).toBe(false);
  });

  it('snaps to target and reports done within one step', () => {
    const { q, done } = stepToward([0.95, 0, 0], [1, 0, 0], 0.1);
    expect(q[0]).toBe(1);
    expect(done).toBe(true);
  });
});
