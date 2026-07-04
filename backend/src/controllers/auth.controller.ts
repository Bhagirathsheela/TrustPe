/**
 * Auth controller — thin handlers per CLAUDE.md "controller / service / model split".
 * Each handler: read validated body → call ONE service method → format response.
 */
import type { Request, Response, NextFunction } from 'express';
import type {
  SignupInput,
  VerifyOtpInput,
  LoginInput,
  RefreshInput,
} from 'trustpe-shared';
import { authService } from '../services/auth.service.js';
import { ctxFromRequest } from '../utils/request-context.js';
import { env } from '../config/env.js';

/**
 * httpOnly refresh cookie for the admin web client. The RN app keeps using
 * the body refreshToken (SecureStore); the controller prefers body over
 * cookie on read, so both coexist. Scoped to /v1/auth so the cookie is only
 * sent to refresh/logout.
 */
const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // match token TTL

function refreshCookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    // Cross-site in prod (admin on Vercel → API on Render) needs None+Secure;
    // localhost dev ports are same-site, so Lax works without https.
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    path: '/v1/auth',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
}

function userToPayload(user: {
  _id: unknown;
  phone: string;
  email: string;
  name: string;
  handle?: string;
  status: string;
  kycStatus: string;
  roles?: string[];
  trustScore?: number;
  trustBand?: string;
}) {
  return {
    id: String(user._id),
    phone: user.phone,
    email: user.email,
    name: user.name,
    handle: user.handle,
    status: user.status,
    kycStatus: user.kycStatus,
    roles: user.roles ?? ['user'],
    trustScore: user.trustScore ?? 300,
    trustBand: user.trustBand ?? 'building',
  };
}

export const authController = {
  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated?.body as SignupInput;
      const result = await authService.signup(body, ctxFromRequest(req, 'user'));
      res.status(202).json({ ok: true, data: { otpSentTo: result.email } });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated?.body as LoginInput;
      const result = await authService.login(body);
      res.status(202).json({ ok: true, data: { otpSentTo: result.email } });
    } catch (err) {
      next(err);
    }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated?.body as VerifyOtpInput;
      const result = await authService.verifyOtp(body, ctxFromRequest(req, 'user'));
      res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
      res.status(200).json({
        ok: true,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          accessExpiresAt: result.accessExpiresAt.toISOString(),
          user: userToPayload(result.user as never),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated?.body as RefreshInput;
      // RN sends refreshToken in body; admin web reads it from httpOnly cookie.
      const raw = body.refreshToken ?? (req.cookies?.refreshToken as string | undefined);
      if (!raw) {
        res.status(401).json({
          ok: false,
          error: { code: 'refresh_missing', message: 'No refresh token provided' },
        });
        return;
      }
      const result = await authService.refresh(raw, ctxFromRequest(req, 'user'));
      res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
      res.status(200).json({
        ok: true,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          accessExpiresAt: result.accessExpiresAt.toISOString(),
          user: userToPayload(result.user as never),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.validated?.body as RefreshInput;
      const raw = body?.refreshToken ?? (req.cookies?.refreshToken as string | undefined);
      await authService.logout(raw, ctxFromRequest(req, 'user'));
      res.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
};
