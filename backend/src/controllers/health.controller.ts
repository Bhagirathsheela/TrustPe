import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { emailService } from '../services/email.service.js';
import { env } from '../config/env.js';

/**
 * Health controller — liveness + readiness.
 *
 *   GET /health          — liveness ping. Always 200 if the process is up.
 *   GET /health/ready    — readiness probe. 200 when the database is
 *                          connected. Other dependencies (email, JWT,
 *                          Cloudinary) are surfaced for ops visibility
 *                          but do NOT fail readiness — the app can still
 *                          accept traffic without them (OTPs stub to
 *                          logs, KYC uploads fall back gracefully).
 *
 * Used by Render's built-in health checker and by hand-run diagnostics.
 */
export const healthController = {
  check(_req: Request, res: Response): void {
    res.json({
      ok: true,
      service: 'trustpe-backend',
      version: '0.1.0',
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  },

  ready(_req: Request, res: Response): void {
    const dbConnected = mongoose.connection.readyState === 1;
    const email = emailService.status();
    const jwtConfigured =
      env.JWT_ACCESS_SECRET.length >= 32 && env.JWT_REFRESH_SECRET.length >= 32;
    const cloudinaryConfigured =
      !!env.CLOUDINARY_CLOUD_NAME && !!env.CLOUDINARY_API_KEY && !!env.CLOUDINARY_API_SECRET;

    // Database is the only hard requirement for readiness. Everything else
    // is a warning surfaced in the body so ops can see what's missing at
    // a glance, but doesn't take the service offline.
    const ready = dbConnected;

    const dependencies = {
      database: {
        ok: dbConnected,
        state: readyStateName(mongoose.connection.readyState),
      },
      email: {
        ok: email.live,
        live: email.live,
        from: email.from,
      },
      jwt: { ok: jwtConfigured },
      cloudinary: { ok: cloudinaryConfigured },
    };

    res.status(ready ? 200 : 503).json({
      ok: ready,
      env: env.NODE_ENV,
      dependencies,
      timestamp: new Date().toISOString(),
    });
  },
};

function readyStateName(state: number): string {
  switch (state) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'unknown';
  }
}
