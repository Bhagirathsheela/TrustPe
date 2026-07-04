/**
 * Admin tracker — Sentry-shaped abstraction (same pattern as backend/mobile).
 *
 * Uses `@sentry/nextjs` when `NEXT_PUBLIC_SENTRY_DSN` is set AND the
 * package is installed. Otherwise falls back to console logging. The
 * global error boundary (`app/global-error.tsx`) and any API helpers
 * that catch fatals go through here.
 *
 * Note on the `NEXT_PUBLIC_` prefix: Next.js exposes env vars with that
 * prefix to the browser bundle. Sentry needs to fire on both server
 * and client crashes, so the DSN has to be visible client-side. This
 * is normal and expected — Sentry DSNs are not secrets (they're
 * effectively write-only public keys).
 */
export type TrackerLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

type SentryLike = {
  init: (opts: {
    dsn: string;
    environment?: string;
    release?: string;
    tracesSampleRate?: number;
  }) => void;
  captureException: (err: unknown, hint?: { extra?: unknown }) => void;
  captureMessage: (message: string, level: TrackerLevel) => void;
};

let sentry: SentryLike | null = null;
let enabled = false;

export const tracker = {
  async init(): Promise<void> {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) {
      enabled = false;
      return;
    }
    try {
      const mod = (await import('@sentry/nextjs')) as unknown as SentryLike;
      mod.init({
        dsn,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_RELEASE_TAG,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      });
      sentry = mod;
      enabled = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[tracker] NEXT_PUBLIC_SENTRY_DSN set but @sentry/nextjs not installed — stub mode',
        err,
      );
    }
  },

  captureException(err: unknown, context?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.error('[tracker] exception', serialiseError(err), context);
    if (!enabled || !sentry) return;
    try {
      sentry.captureException(err, { extra: context });
    } catch {
      /* */
    }
  },

  captureMessage(message: string, level: TrackerLevel = 'info'): void {
    // eslint-disable-next-line no-console
    console.log(`[tracker] ${level}: ${message}`);
    if (!enabled || !sentry) return;
    try {
      sentry.captureMessage(message, level);
    } catch {
      /* */
    }
  },
};

function serialiseError(err: unknown): { name?: string; message: string; stack?: string } {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  if (typeof err === 'string') return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: 'Non-serialisable error' };
  }
}
