/**
 * Backend tracker — Sentry-shaped abstraction.
 *
 * Stub mode for now: logs to Pino, no external transport. When Sentry
 * is needed, this is the single switch point — add `@sentry/node` to
 * deps and swap the init/capture bodies. Call sites don't change.
 *
 * The stub-vs-real toggle is `SENTRY_DSN` in env — if set, we assume
 * Sentry is wired; if blank, silent stub. Currently blank is the only
 * supported mode.
 *
 * See docs/BUILD_PLAN.md for the wire-up plan when we bring this back.
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

export const tracker = {
  async init(): Promise<void> {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
      logger.info('[tracker] no SENTRY_DSN — running in stub mode');
      return;
    }
    // TODO(sentry): install @sentry/node and replace with:
    //   const Sentry = await import('@sentry/node');
    //   Sentry.init({ dsn, environment: env.NODE_ENV, tracesSampleRate: 0.1 });
    logger.warn('[tracker] SENTRY_DSN set but SDK not installed — stub mode');
  },

  captureException(err: unknown, context?: TrackerContext): void {
    const safe = serialiseError(err);
    logger.error(
      { err: safe, context, env: env.NODE_ENV, ts: new Date().toISOString() },
      '[tracker] uncaught exception',
    );
    // TODO(sentry): Sentry.captureException(err, { user, extra });
  },

  captureMessage(message: string, level: TrackerLevel = 'info', context?: TrackerContext): void {
    logger[level === 'error' || level === 'fatal' ? 'error' : 'info'](
      { context },
      `[tracker] ${message}`,
    );
    // TODO(sentry): Sentry.captureMessage(message, level);
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
