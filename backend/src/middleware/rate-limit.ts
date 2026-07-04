/**
 * Rate limiting — dependency-free fixed-window limiter.
 *
 * Phase 1 default: in-memory Map (single-process Render free tier — same
 * rationale as otp-store.service.ts). Restart resets counters, which is
 * acceptable; the OTP store's own 5-attempts-per-code cap still holds.
 * Phase 3 (Redis online): swap the store without touching the routes.
 *
 * Responses use the standard error envelope so both clients render the
 * message with their existing ApiError handling.
 */
import type { RequestHandler } from 'express';

type Bucket = { count: number; resetAt: number };

type LimiterOptions = {
  windowMs: number;
  limit: number;
  /** Derives the counter key. Defaults to req.ip. */
  keyGenerator?: (req: Parameters<RequestHandler>[0]) => string;
  code?: string;
  message?: string;
};

export function createRateLimiter(opts: LimiterOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  // Periodic sweep so abandoned keys don't accumulate forever.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets.entries()) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }, opts.windowMs);
  sweep.unref();

  return (req, res, next) => {
    const key = opts.keyGenerator ? opts.keyGenerator(req) : (req.ip ?? 'unknown');
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    res.setHeader('RateLimit-Limit', String(opts.limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, opts.limit - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (bucket.count > opts.limit) {
      res.status(429).json({
        ok: false,
        error: {
          code: opts.code ?? 'rate_limited',
          message: opts.message ?? 'Too many requests. Please try again later.',
        },
      });
      return;
    }
    next();
  };
}

const FIFTEEN_MIN = 15 * 60 * 1000;

/** OTP issuance (signup/login): 5 per email per 15 min. */
export const otpRequestLimiter = createRateLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 5,
  keyGenerator: (req) =>
    `email:${String((req.body as { email?: string } | undefined)?.email ?? req.ip ?? 'unknown').toLowerCase()}`,
  message: 'Too many codes requested for this email. Please wait a few minutes.',
});

/** OTP issuance: 20 per IP per 15 min (stops one IP spraying many emails). */
export const otpRequestIpLimiter = createRateLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 20,
});

/** OTP verification: 10 attempts per IP per 15 min (each code caps at 5 anyway). */
export const otpVerifyLimiter = createRateLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 10,
  message: 'Too many verification attempts. Please wait a few minutes.',
});

/** Refresh/logout guard: 60 per IP per 15 min. */
export const authTokenLimiter = createRateLimiter({
  windowMs: FIFTEEN_MIN,
  limit: 60,
});
