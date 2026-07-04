/**
 * Zod-based request body validator.
 *
 * Usage:
 *   router.post('/signup', validateBody(signupSchema), authController.signup)
 *
 * The parsed (and transformed) result is attached to `req.validated.body`
 * so the controller reads typed data, not raw req.body.
 */
import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    try {
      const parsed = schema.parse(req.body);
      req.validated = { ...(req.validated ?? {}), body: parsed };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    try {
      const parsed = schema.parse(req.query);
      req.validated = { ...(req.validated ?? {}), query: parsed };
      next();
    } catch (err) {
      next(err);
    }
  };
}
