import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import { requireAuth, optionalAuth, type AuthedRequest } from '../src/middleware/auth.js';
import { signToken } from '../src/auth/jwt.js';

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = vi.fn().mockReturnValue(res) as unknown as Response['json'];
  return res;
}

describe('requireAuth', () => {
  it('401s when no Authorization header is present', () => {
    const req = { headers: {} } as AuthedRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.userId).toBeUndefined();
  });

  it('401s on a malformed / non-Bearer header', () => {
    const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } } as AuthedRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s on an invalid/garbage token', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } } as AuthedRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches userId and calls next() on a valid token', () => {
    const token = signToken({ sub: 7, email: 'operator@example.com' });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthedRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(req.userId).toBe(7);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  it('proceeds as a guest (no userId) when no token is present — never rejects', () => {
    const req = { headers: {} } as AuthedRequest;
    const res = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('proceeds as a guest on an invalid token rather than rejecting the request', () => {
    const req = { headers: { authorization: 'Bearer garbage' } } as AuthedRequest;
    const res = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('attaches userId when a valid token is present', () => {
    const token = signToken({ sub: 3, email: 'other@example.com' });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthedRequest;
    const res = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, next);

    expect(req.userId).toBe(3);
    expect(next).toHaveBeenCalledOnce();
  });
});
