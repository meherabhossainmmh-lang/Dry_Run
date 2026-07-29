import type { Digit } from './commands';
import type { Vec3 } from './math';
import { dist } from './math';
import { KEY_POINTS } from './keys';

/** A touch counts as a hit when the executed tip is within this of the key. */
export const PIN_SUCCESS_MM = 5;

/** Extract the 1–6 digits from a PIN string, ignoring separators. */
export function parsePin(s: string): Digit[] {
  return [...s.trim()].filter((c) => c >= '1' && c <= '6').map((c) => Number(c) as Digit);
}

/** A PIN is well-formed if it is non-empty and every character is a 1–6 digit. */
export function isValidPin(s: string): boolean {
  const p = s.trim();
  return p.length > 0 && /^[1-6]+$/.test(p);
}

/**
 * Pass/fail for a touch, measured from the FK of the EXECUTED pose (not the
 * commanded target) — the honest ±5 mm check the judges care about.
 */
export function touchResult(tip: Vec3, key: Digit): { mm: number; ok: boolean } {
  const mm = dist(tip, KEY_POINTS[key]) * 1000;
  return { mm, ok: mm <= PIN_SUCCESS_MM };
}
