import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export interface TokenPayload {
  sub: number; // user id
  email: string;
}

export function signToken(payload: TokenPayload): string {
  // Added configurable expiration for enhanced security
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as unknown as TokenPayload;
}

