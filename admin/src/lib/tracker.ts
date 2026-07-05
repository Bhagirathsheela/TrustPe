/**
 * Admin tracker — Sentry-shaped abstraction (stub mode).
 *
 * Used by the global error boundary (`app/global-error.tsx`) and any API
 * helpers that catch fatals. Currently console-only; wire `@sentry/nextjs`
 * later when observability is a real priority.
 */
export type TrackerLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export const tracker = {
  async init(): Promise<void> {
    // TODO(sentry): install @sentry/nextjs and replace with:
    //   const Sentry = await import('@sentry/nextjs');
    //   Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, ... });
  },

  captureException(err: unknown, context?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.error('[tracker] exception', serialiseError(err), context);
    // TODO(sentry): Sentry.captureException(err, { extra: context });
  },

  captureMessage(message: string, level: TrackerLevel = 'info'): void {
    // eslint-disable-next-line no-console
    console.log(`[tracker] ${level}: ${message}`);
    // TODO(sentry): Sentry.captureMessage(message, level);
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
