import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { tracker } from '../utils/tracker.js';

/**
 * Centralized error handler. All thrown errors land here.
 *
 * Convention: services throw `AppError` with a `code` for client-facing errors.
 * Anything else is treated as an internal error and surfaces a generic message.
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 400,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Zod validation errors (route-level body parsing)
  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  // Application errors (services throw these intentionally)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ok: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Anything else: log full detail, ship to tracker, return generic message
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  tracker.captureException(err, {
    userId: (req as { user?: { id: string } }).user?.id,
    route: req.url,
    method: req.method,
    ip: req.ip,
  });
  res.status(500).json({
    ok: false,
    error: { code: 'internal_error', message: 'Something went wrong on our side' },
  });
};
