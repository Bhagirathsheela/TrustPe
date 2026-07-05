import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { emailService } from '../services/email.service.js';
import { env } from '../config/env.js';

/**
 * Health controller — liveness + readiness.
 *
 *   GET /health          — liveness ping. Always 200 if the process is up.
 *   GET /health/ready    — readiness probe. 200 only when DB is connected
 *                          AND critical env is set. 503 otherwise.
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
    const jwtConfigured = env.JWT_ACCESS_SECRET.length >= 32 && env.JWT_REFRESH_SECRET.length >= 32;
    const cloudinaryConfigured =
      !!env.CLOUDINARY_CLOUD_NAME && !!env.CLOUDINARY_API_KEY && !!env.CLOUDINARY_API_SECRET;

    // Deliberately verbose so operators can see what's missing at a glance.
    // Response body stays JSON in either case so the checker parses uniformly.
    const dependencies = {
      database: {
        ok: dbConnected,
        state: readyStateName(mongoose.connection.readyState),
      },
      email: {
        // Stubbed mail is fine in development — only "not-live" fails
        // readiness when NODE_ENV is production.
        ok: env.NODE_ENV !== 'production' || email.live,
        live: email.live,
        from: email.from,
      },
      jwt: { ok: jwtConfigured },
      cloudinary: { ok: cloudinaryConfigured },
    };
    const ready = Object.values(dependencies).every((d) => d.ok);

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
