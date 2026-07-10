import { describe, it, expect } from 'vitest';
import { parsePin, isValidPin, touchResult, PIN_SUCCESS_MM } from '../src/core/pin';
import { precomputeKeyPoses } from '../src/core/ik';
import { fk } from '../src/core/fk';
import { KEY_POINTS } from '../src/core/keys';
import type { Digit } from '../src/core/commands';

describe('PIN parsing', () => {
  it('extracts 1–6 digits and ignores separators', () => {
    expect(parsePin('1-3-5')).toEqual([1, 3, 5]);
    expect(parsePin(' 2 4 6 ')).toEqual([2, 4, 6]);
  });
  it('validates only 1–6 digit strings', () => {
    expect(isValidPin('135246')).toBe(true);
    expect(isValidPin('1207')).toBe(false); // 0 and 7 not on the pad
    expect(isValidPin('')).toBe(false);
  });
});

describe('PIN pipeline — executed pose lands within 5 mm', () => {
  const poses = precomputeKeyPoses();

  it('every digit of a full PIN passes from its precomputed touch pose', () => {
    for (const key of parsePin('135246')) {
      const res = touchResult(fk(poses[key].touch), key);
      expect(res.ok, `key ${key} @ ${res.mm.toFixed(2)}mm`).toBe(true);
      expect(res.mm).toBeLessThan(PIN_SUCCESS_MM);
    }
  });

  it('flags a genuinely-off touch as fail', () => {
    const off = KEY_POINTS[1].map((v, i) => v + (i === 0 ? 0.02 : 0)) as [number, number, number];
    const res = touchResult(off, 1 as Digit); // 20 mm away in X
    expect(res.ok).toBe(false);
    expect(res.mm).toBeGreaterThan(PIN_SUCCESS_MM);
  });
});
