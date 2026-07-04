/**
 * Background jobs — Phase 1 uses vanilla setInterval (no Redis/BullMQ).
 *
 * Add new jobs here so server.ts has one entry point.
 */
import { startEmiReminderJob } from './emi-reminder.job.js';
import { startExpirySweepJob } from './expiry-sweep.job.js';
import { logger } from '../utils/logger.js';

export type RunningJob = { stop: () => void };

export function startBackgroundJobs(): RunningJob[] {
  const jobs: RunningJob[] = [];
  jobs.push(startEmiReminderJob());
  jobs.push(startExpirySweepJob());
  logger.info({ count: jobs.length }, '[jobs] background jobs started');
  return jobs;
}

export function stopBackgroundJobs(jobs: RunningJob[]): void {
  for (const j of jobs) {
    try {
      j.stop();
    } catch {
      /* */
    }
  }
}
