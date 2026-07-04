/**
 * Error / telemetry tracker — Sentry-shaped abstraction.
 *
 * Phase 1: stub implementation that logs to console and keeps an in-memory
 * breadcrumb ring (last 50 events). When Sentry is ready, swap the body of
 * each function to call `@sentry/react-native` with the same input shape;
 * the rest of the app keeps working unchanged.
 *
 * The API mirrors Sentry's so the swap is mechanical:
 *   - init(config)            → Sentry.init(config)
 *   - captureException(err)   → Sentry.captureException(err)
 *   - captureMessage(msg)     → Sentry.captureMessage(msg)
 *   - addBreadcrumb(crumb)    → Sentry.addBreadcrumb(crumb)
 *   - setUser({id,email})     → Sentry.setUser({id,email})
 *   - clearUser()             → Sentry.setUser(null)
 */

export type TrackerLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export type TrackerBreadcrumb = {
  category?: string;
  message: string;
  level?: TrackerLevel;
  data?: Record<string, unknown>;
  timestamp?: number;
};

export type TrackerUser = { id?: string; email?: string };

export type TrackerConfig = {
  dsn?: string;
  environment?: string;
  release?: string;
  enabled?: boolean;
};

const BREADCRUMB_LIMIT = 50;
const breadcrumbs: TrackerBreadcrumb[] = [];
let config: TrackerConfig = { enabled: false };
let currentUser: TrackerUser | null = null;

export const tracker = {
  init(cfg: TrackerConfig): void {
    config = { enabled: !!cfg.dsn, ...cfg };
    if (!config.enabled) {
      console.info('[tracker] running in stub mode (no DSN configured)');
    } else {
      // TODO(sentry): replace this branch with Sentry.init when ready.
      //   import * as Sentry from '@sentry/react-native';
      //   Sentry.init({ dsn, environment, release, tracesSampleRate: 0.2 });
      console.info('[tracker] DSN set but Sentry SDK not yet wired in');
    }
  },

  captureException(err: unknown, context?: Record<string, unknown>): void {
    const safe = serialiseError(err);
    console.error('[tracker] exception', safe, context, {
      user: currentUser,
      breadcrumbs: breadcrumbs.slice(-10),
    });
    // TODO(sentry): Sentry.captureException(err, { extra: context });
  },

  captureMessage(message: string, level: TrackerLevel = 'info'): void {
    console.log(`[tracker] ${level}: ${message}`);
    // TODO(sentry): Sentry.captureMessage(message, level);
  },

  addBreadcrumb(crumb: TrackerBreadcrumb): void {
    const entry: TrackerBreadcrumb = {
      level: 'info',
      timestamp: Date.now(),
      ...crumb,
    };
    breadcrumbs.push(entry);
    if (breadcrumbs.length > BREADCRUMB_LIMIT) breadcrumbs.shift();
    // TODO(sentry): Sentry.addBreadcrumb(entry);
  },

  setUser(user: TrackerUser): void {
    currentUser = user;
    // TODO(sentry): Sentry.setUser({ id: user.id, email: user.email });
  },

  clearUser(): void {
    currentUser = null;
    // TODO(sentry): Sentry.setUser(null);
  },

  /** For the in-app debug screen — peek at recent breadcrumbs. */
  recentBreadcrumbs(): TrackerBreadcrumb[] {
    return breadcrumbs.slice();
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
