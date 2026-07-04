/**
 * TrustPe backend — entry point.
 *
 * Connects to MongoDB, boots the Express app, attaches Socket.io to the
 * same HTTP server, then handles graceful shutdown.
 */
import 'dotenv/config';
import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import { attachRealtime } from './socket/index.js';
import { startBackgroundJobs, stopBackgroundJobs, type RunningJob } from './jobs/index.js';
import { tracker } from './utils/tracker.js';

async function bootstrap(): Promise<void> {
  await tracker.init(); // before anything else so init errors get captured
  await connectDatabase();
  const app = createApp();
  const server = http.createServer(app);

  // Socket.io shares the same HTTP server as Express — one port, one process.
  attachRealtime(server);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'TrustPe backend listening');
  });

  // Background jobs (EMI reminders, etc.)
  const jobs: RunningJob[] = startBackgroundJobs();

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return; // second SIGINT/SIGTERM: already draining
    shuttingDown = true;
    logger.info({ signal }, 'Shutdown signal received');
    stopBackgroundJobs(jobs);
    // Drain in-flight requests before dropping the DB connection.
    await new Promise<void>((resolve) => server.close(() => resolve()));
    logger.info('HTTP server closed');
    await disconnectDatabase();
    process.exit(0);
  }
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// Last-resort safety nets for promises with no .catch() and synchronous
// throws outside the request lifecycle. Without these, Node 20 will exit
// the process on unhandled rejections.
process.on('unhandledRejection', (reason) => {
  tracker.captureException(reason, { route: 'process.unhandledRejection' });
  logger.error({ reason }, '[server] unhandled rejection');
});
process.on('uncaughtException', (err) => {
  tracker.captureException(err, { route: 'process.uncaughtException' });
  logger.error({ err }, '[server] uncaught exception');
});

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to bootstrap backend');
  tracker.captureException(err, { route: 'bootstrap' });
  process.exit(1);
});
