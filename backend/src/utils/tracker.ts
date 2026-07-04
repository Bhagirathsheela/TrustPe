/**
 * Backend tracker — Sentry-shaped abstraction.
 *
 * Wires up `@sentry/node` when `SENTRY_DSN` is set. Falls back to the
 * Pino-logging stub if the DSN is blank OR the Sentry package isn't
 * installed (graceful degradation — the app still boots so a missing
 * dep never blocks a deploy).
 *
 * Use it from the error-handler middleware (uncaught exceptions) and
 * from any service that catches an exception it can't meaningfully
 * handle.
 */
import { env } from '../config/env.js';
import { logger } from './logger.js';

export type TrackerLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export type TrackerContext = {
  userId?: string;
  traceId?: string;
  route?: string;
  method?: string;
  ip?: string;
  extra?: Record<string, unknown>;
};

// Minimal shape we exercise from @sentry/node — kept narrow so the code
// doesn't fight the SDK's evolving public types.
type SentryLike = {
  init: (opts: {
    dsn: string;
    environment?: string;
    release?: string;
    tracesSampleRate?: number;
    integrations?: unknown[];
  }) => void;
  captureException: (err: unknown, hint?: { user?: unknown; extra?: unknown }) => void;
  captureMessage: (message: string, level: TrackerLevel) => void;
  setUser: (user: { id?: string } | null) => void;
  addBreadcrumb: (crumb: Record<string, unknown>) => void;
};

let sentry: SentryLike | null = null;
let enabled = false;

export const tracker = {
  /**
   * Set up Sentry if a DSN is present and the package is installed.
   * Fire-and-forget: no await needed at the call site — the promise
   * resolves before any real traffic hits the box in practice, and if
   * it doesn't, we fall back to stub mode which is fine.
   */
  async init(): Promise<void> {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
      logger.info('[tracker] no SENTRY_DSN — running in stub mode');
      return;
    }

    try {
      // Dynamic import so the package is optional. If it isn't installed,
      // we log a clear message and stay in stub mode rather than crashing.
      const mod = (await import('@sentry/node')) as unknown as SentryLike;
      mod.init({
        dsn,
        environment: env.NODE_ENV,
        release: process.env.RELEASE_TAG,
        tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
      });
      sentry = mod;
      enabled = true;
      logger.info({ env: env.NODE_ENV }, '[tracker] Sentry live');
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        '[tracker] SENTRY_DSN set but @sentry/node not installed — staying in stub mode',
      );
    }
  },

  captureException(err: unknown, context?: TrackerContext): void {
    const safe = serialiseError(err);
    logger.error(
      { err: safe, context, env: env.NODE_ENV, ts: new Date().toISOString() },
      '[tracker] uncaught exception',
    );
    if (!enabled || !sentry) return;
    try {
      sentry.captureException(err, {
        user: context?.userId ? { id: context.userId } : undefined,
        extra: {
          traceId: context?.traceId,
          route: context?.route,
          method: context?.method,
          ip: context?.ip,
          ...context?.extra,
        },
      });
    } catch (sentryErr) {
      logger.warn({ err: sentryErr }, '[tracker] Sentry capture failed');
    }
  },

  captureMessage(message: string, level: TrackerLevel = 'info', context?: TrackerContext): void {
    logger[level === 'error' || level === 'fatal' ? 'error' : 'info']({ context }, `[tracker] ${message}`);
    if (!enabled || !sentry) return;
    try {
      sentry.captureMessage(message, level);
    } catch {
      /* */
    }
  },
};

function serialiseError(err: unknown): { name?: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (typeof err === 'string') return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: 'Non-serialisable error' };
  }
}
