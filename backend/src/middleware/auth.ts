/**
 * Auth middleware.
 *
 * `requireAuth` parses the Bearer token, verifies it, and attaches `req.user`.
 * `requireRoles(...)` is a follow-up middleware that enforces RBAC.
 */
import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from './error-handler.js';
import type { UserRole } from 'trustpe-shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        roles: UserRole[];
        kycStatus: string;
      };
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('unauthorized', 'Missing or invalid Authorization header', 401));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const claims = verifyAccessToken(token);
    req.user = { id: claims.sub, roles: claims.roles, kycStatus: claims.kycStatus };
    next();
  } catch {
    next(new AppError('token_invalid', 'Invalid or expired access token', 401));
  }
};

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('unauthorized', 'Not authenticated', 401));
    }
    const hasRole = req.user.roles.some((r) => roles.includes(r));
    if (!hasRole) {
      return next(new AppError('forbidden', 'Insufficient role', 403));
    }
    next();
  };
}
