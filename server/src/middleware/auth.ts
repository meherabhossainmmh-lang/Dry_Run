import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../auth/jwt.js';

export interface AuthedRequest extends Request {
  userId?: number;
}

/**
 * Requires a valid Bearer token. Registered-operator-only routes use this.
 */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'AUTH_EXPIRED' });
  }
}

/**
 * Attaches userId if a valid token is present, but never rejects the
 * request. Used by routes (like event logging) that guest operators may
 * also call — the safety gate applies to every source equally; auth just
 * determines whose history the event is filed under.
 */
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (token) {
    try {
      req.userId = verifyToken(token).sub;
    } catch {
      // Invalid/expired token on an optional route — proceed as a guest
      // rather than failing the request.
    }
  }
  next();
}

// contribution audit 2026-07-25 11:45:00