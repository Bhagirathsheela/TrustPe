/**
 * JWT signing + verification for access tokens.
 *
 * Refresh tokens are opaque random bytes (see utils/crypto.ts), not JWTs —
 * we look them up in Mongo by SHA-256 hash, which lets us revoke them.
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from 'trustpe-shared';

export type AccessTokenClaims = {
  sub: string; // user id
  roles: UserRole[];
  kycStatus: string;
};

export function signAccessToken(claims: AccessTokenClaims): {
  token: string;
  expiresAt: Date;
} {
  // jsonwebtoken accepts numeric seconds or string like '15m'
  const token = jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });

  // Decode to read the exp claim back out without re-parsing.
  const decoded = jwt.decode(token);
  const expSec =
    typeof decoded === 'object' && decoded !== null && typeof decoded.exp === 'number'
      ? decoded.exp
      : Math.floor(Date.now() / 1000) + 15 * 60;

  return { token, expiresAt: new Date(expSec * 1000) };
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  if (typeof payload === 'string') {
    throw new Error('Unexpected JWT payload shape');
  }
  return payload as unknown as AccessTokenClaims;
}
