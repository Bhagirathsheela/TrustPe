/**
 * Expiry sweep cron.
 *
 * Transitions records past their `expiresAt` into terminal 'expired' state:
 *   - LoanRequest: open → expired (30-day TTL set at creation)
 *   - PaymentIntent: awaiting_payer_evidence → expired (7-day TTL)
 *     (payer_confirmed intents are NOT expired — money may already have
 *     moved; those wait for attestation or admin dispute review.)
 *
 * Read-paths already filter expired records defensively (search/fund/
 * evidence guards), so this job is bookkeeping: it makes state honest and
 * writes audit rows. Vanilla setInterval per Phase 1 (no Redis/BullMQ).
 */
import { LoanRequest } from '../models/LoanRequest.js';
import { PaymentIntent } from '../models/PaymentIntent.js';
import { writeAudit } from '../utils/audit.js';
import { logger } from '../utils/logger.js';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly

const SYSTEM_CTX = { actorType: 'system' as const };

async function runOnce(): Promise<void> {
  const now = new Date();

  // Loan requests — small batches so audit rows stay 1:1 with transitions.
  const staleRequests = await LoanRequest.find({
    status: 'open',
    expiresAt: { $lte: now },
  }).limit(200);
  for (const request of staleRequests) {
    // Conditional update so a concurrent fund() that just matched it wins.
    const updated = await LoanRequest.findOneAndUpdate(
      { _id: request._id, status: 'open' },
      { $set: { status: 'expired' } },
      { new: true },
    );
    if (!updated) continue;
    await writeAudit(SYSTEM_CTX, {
      action: 'loan_request.expired',
      entityType: 'loan_request',
      entityId: String(updated._id),
      before: { status: 'open' },
      after: { status: 'expired' },
    });
  }

  const staleIntents = await PaymentIntent.find({
    status: 'awaiting_payer_evidence',
    expiresAt: { $lte: now },
  }).limit(200);
  for (const intent of staleIntents) {
    const updated = await PaymentIntent.findOneAndUpdate(
      { _id: intent._id, status: 'awaiting_payer_evidence' },
      { $set: { status: 'expired' } },
      { new: true },
    );
    if (!updated) continue;
    await writeAudit(SYSTEM_CTX, {
      action: 'payment.expired',
      entityType: 'payment_intent',
      entityId: String(updated._id),
      before: { status: 'awaiting_payer_evidence' },
      after: { status: 'expired' },
    });
  }

  const total = staleRequests.length + staleIntents.length;
  if (total > 0) {
    logger.info(
      { requests: staleRequests.length, intents: staleIntents.length },
      '[expiry-sweep] transitioned stale records',
    );
  }
}

export function startExpirySweepJob(): { stop: () => void } {
  void runOnce().catch((err) => logger.warn({ err }, '[expiry-sweep] first run failed'));
  const interval = setInterval(() => {
    void runOnce().catch((err) => logger.warn({ err }, '[expiry-sweep] run failed'));
  }, SWEEP_INTERVAL_MS);
  return { stop: () => clearInterval(interval) };
}
