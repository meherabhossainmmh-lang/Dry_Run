import { describe, it, expect } from 'vitest';
import { validate } from '../src/core/validate';
import { KEY_POINTS } from '../src/core/keys';

const Z7 = [0, 0, 0, 0, 0, 0, 0];

describe('validate — the shared motion gate', () => {
  it('passes home and stop unconditionally', () => {
    expect(validate({ type: 'home', source: 'voice' }, Z7).ok).toBe(true);
    expect(validate({ type: 'stop', source: 'keyboard' }, Z7).ok).toBe(true);
  });

  it('rejects a rotateJoint past the joint limit', () => {
    expect(validate({ type: 'rotateJoint', joint: 1, toRad: 3.0, source: 'voice' }, Z7).ok).toBe(false);
  });

  it('passes a rotateJoint within limits', () => {
    expect(validate({ type: 'rotateJoint', joint: 0, toRad: 1.0, source: 'voice' }, Z7).ok).toBe(true);
  });

  it('rejects a moveTo beyond the reach sphere', () => {
    expect(validate({ type: 'moveTo', xyz: [2.0, 0, 0.5], source: 'voice' }, Z7).ok).toBe(false);
  });

  it('rejects a moveTo below the floor', () => {
    expect(validate({ type: 'moveTo', xyz: [0.4, 0, -0.1], source: 'voice' }, Z7).ok).toBe(false);
  });

  it('passes touching every configured key (all within reach)', () => {
    for (const k of [1, 2, 3, 4, 5, 6] as const) {
      expect(KEY_POINTS[k]).toBeDefined();
      expect(validate({ type: 'touchKey', key: k, source: 'auto' }, Z7).ok).toBe(true);
    }
  });

  it('rejects a PIN with non 1–6 digits', () => {
    expect(validate({ type: 'typePin', pin: '1289', source: 'auto' }, Z7).ok).toBe(false);
  });

  it('passes a well-formed PIN', () => {
    expect(validate({ type: 'typePin', pin: '135246', source: 'auto' }, Z7).ok).toBe(true);
  });
});
