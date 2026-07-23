import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from '../src/auth/jwt.js';

describe('signToken / verifyToken', () => {
  it('round-trips the payload', () => {
    const token = signToken({ sub: 42, email: 'operator@example.com' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe(42);
    expect(payload.email).toBe('operator@example.com');
  });

  it('rejects a tampered token', () => {
    const token = signToken({ sub: 1, email: 'x@example.com' });
    // Flip the last two characters of the signature — still well-formed
    // base64url, just cryptographically invalid.
    const flipped = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    expect(() => verifyToken(flipped)).toThrow();
  });

  it('rejects a token signed with a different secret', () => {
    // Simulates a token forged without knowing JWT_SECRET.
    const forged = jwt.sign({ sub: 1, email: 'x@example.com' }, 'wrong-secret');
    expect(() => verifyToken(forged)).toThrow();
  });

  it('rejects an already-expired token', () => {
    const expired = jwt.sign(
      { sub: 1, email: 'x@example.com' },
      process.env.JWT_SECRET as string,
      { expiresIn: '-1s' },
    );
    expect(() => verifyToken(expired)).toThrow();
  });
});
