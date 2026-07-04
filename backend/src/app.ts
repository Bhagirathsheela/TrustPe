/**
 * Express app factory.
 *
 * Kept separate from `server.ts` so integration tests can import `createApp()`
 * without booting a network listener. See docs/TESTING.md §3.2.
 *
 * MVC layering:
 *   routes/      → mount Express routers, one file per resource
 *   controllers/ → request handlers, thin: parse → call service → format response
 *   services/    → business logic + external API calls
 *   models/      → Mongoose schemas
 *   middleware/  → auth, validation, error handling, rate limit
 */
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger.js';
import { env } from './config/env.js';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found-handler.js';

export function createApp(): Express {
  const app = express();

  // Trust proxy headers from Render / Vercel for correct req.ip
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet());

  // CORS — explicit allowlist, never '*'
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );

  // Body parser with size limit
  app.use(express.json({ limit: '1mb' }));

  // Parse cookies (admin web uses httpOnly refresh cookie)
  app.use(cookieParser());

  // Structured request logging via Pino
  app.use(pinoHttp({ logger }));

  // Mount routes
  app.use(router);

  // 404 + error handlers must be last
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
