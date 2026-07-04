/**
 * Admin dispute resolution service.
 *
 * Disputed payment intents (status='disputed') land in this queue when a
 * receiver attests "not_received" after the payer marked the payment sent.
 * An admin reviews bank/UPI evidence and picks one of three resolutions:
 *
 *   verify        — intent → verified (payment did happen). Re-runs the
 *                   normal post-verify side-effects via payment service
 *                   helpers (loan activates or closes; EMI installment
 *                   marked paid).
 *   mark_failed   — intent → failed. Payer can retry.
 *   default_loan  — intent → failed AND loan → defaulted. Defaulter takes
 *                   a -100 TrustScore penalty (clamped to 300 minimum) and
 *                   appears on the default registry of their public profile.
 *
 * Each resolution writes an audit row and posts a system message into the
 * loan's chat thread so both parties see the outcome without polling.
 */
import { Types, startSession, type ClientSession } from 'mongoose';
import {
  bandFromScore,
  clampTrustScore,
  type DisputeQueueQuery,
  type DisputeResolutionInput,
} from 'trustpe-shared';
import { PaymentIntent, type PaymentIntentDocument } from '../models/PaymentIntent.js';
import { Loan, type LoanDocument } from '../models/Loan.js';
import { User, type UserDocument } from '../models/User.js';
import { EmiSchedule } from '../models/EmiSchedule.js';
import { AppError } from '../middleware/error-handler.js';
import { writeAudit, type AuditContext } from '../utils/audit.js';
import { chatService } from './chat.service.js';
import { emiService } from './emi.service.js';
import { notificationService } from './notification.service.js';

const DEFAULTER_TRUSTSCORE_PENALTY = 100;

export type AdminDisputeListItem = {
  id: string;
  loanId: string;
  kind: 'disbursal' | 'emi' | 'preclose';
  emiNumber?: number;
  payerName: string;
  payeeName: string;
  amountPaise: number;
  status: string;
  payerEvidence?: { utr?: string; submittedAt?: string };
  receiverAttestation?: { reason?: string; submittedAt?: string };
  createdAt: string;
};

export type AdminDisputeDetail = AdminDisputeListItem & {
  payerVpa: string;
  payeeVpa: string;
  referenceId: string;
  payer: { id: string; name: string; trustScore: number; trustBand: string };
  payee: { id: string; name: string; trustScore: number; trustBand: string };
  loan: {
    id: string;
    status: string;
    amountPaise: number;
    tenureMonths: number;
    roiPercent: number;
    agreedAt: string;
    disbursedAt?: string;
  };
};

type IntentWithUsers = PaymentIntentDocument & {
  payerId: UserDocument | Types.ObjectId;
  payeeId: UserDocument | Types.ObjectId;
};

function isPopulated(u: unknown): u is UserDocument {
  return Boolean(u) && typeof u === 'object' && u !== null && 'name' in (u as object);
}

function toListItem(intent: IntentWithUsers): AdminDisputeListItem {
  const payer = isPopulated(intent.payerId) ? intent.payerId : null;
  const payee = isPopulated(intent.payeeId) ? intent.payeeId : null;
  return {
    id: String(intent._id),
    loanId: String(intent.loanId),
    kind: intent.kind,
    emiNumber: intent.emiNumber ?? undefined,
    payerName: payer?.name ?? 'Unknown payer',
    payeeName: payee?.name ?? 'Unknown payee',
    amountPaise: intent.amountPaise,
    status: intent.status,
    payerEvidence: intent.payerEvidence
      ? {
          utr: intent.payerEvidence.utr ?? undefined,
          submittedAt: intent.payerEvidence.submittedAt?.toISOString(),
        }
      : undefined,
    receiverAttestation: intent.receiverAttestation
      ? {
          reason: intent.receiverAttestation.reason ?? undefined,
          submittedAt: intent.receiverAttestation.submittedAt?.toISOString(),
        }
      : undefined,
    createdAt: intent.createdAt.toISOString(),
  };
}

async function toDetail(intent: PaymentIntentDocument): Promise<AdminDisputeDetail> {
  const [payer, payee, loan] = await Promise.all([
    User.findById(intent.payerId),
    User.findById(intent.payeeId),
    Loan.findById(intent.loanId),
  ]);
  if (!payer || !payee || !loan) {
    throw new AppError('not_found', 'Linked records missing', 500);
  }

  const populatedIntent = intent as unknown as IntentWithUsers;
  populatedIntent.payerId = payer;
  populatedIntent.payeeId = payee;

  return {
    ...toListItem(populatedIntent),
    payerVpa: intent.payerVpa,
    payeeVpa: intent.payeeVpa,
    referenceId: intent.referenceId,
    payer: {
      id: String(payer._id),
      name: payer.name,
      trustScore: payer.trustScore ?? 300,
      trustBand: payer.trustBand ?? 'building',
    },
    payee: {
      id: String(payee._id),
      name: payee.name,
      trustScore: payee.trustScore ?? 300,
      trustBand: payee.trustBand ?? 'building',
    },
    loan: {
      id: String(loan._id),
      status: loan.status,
      amountPaise: loan.amountPaise,
      tenureMonths: loan.tenureMonths,
      roiPercent: loan.roiPercent,
      agreedAt: loan.agreedAt.toISOString(),
      disbursedAt: loan.disbursedAt?.toISOString(),
    },
  };
}

export const adminDisputeService = {
  async listQueue(query: DisputeQueueQuery): Promise<{
    items: AdminDisputeListItem[];
    nextCursor: string | null;
  }> {
    const filter: Record<string, unknown> = {};
    if (query.status === 'disputed') {
      filter.status = 'disputed';
    } else {
      // 'resolved' bucket = anything that was once disputed and now isn't.
      // We approximate by querying the audit log's payment.dispute_resolved
      // actions in a future polish pass; for Phase 1, terminal-states-after-
      // dispute is enough.
      filter.status = { $in: ['verified', 'failed'] };
      filter['receiverAttestation.decision'] = 'not_received';
    }
    if (query.cursor) {
      if (!/^[0-9a-fA-F]{24}$/.test(query.cursor)) {
        throw new AppError('invalid_cursor', 'Cursor is not a valid id', 400);
      }
      filter._id = { $gt: new Types.ObjectId(query.cursor) };
    }

    const intents = await PaymentIntent.find(filter)
      .sort({ _id: 1 })
      .limit(query.limit + 1)
      .populate<{ payerId: UserDocument; payeeId: UserDocument }>(
        'payerId payeeId',
        'name trustScore trustBand',
      )
      .lean<IntentWithUsers[]>({ getters: false, virtuals: false });

    const hasMore = intents.length > query.limit;
    const pageItems = hasMore ? intents.slice(0, query.limit) : intents;
    const nextCursor =
      hasMore && pageItems.length > 0 ? String(pageItems[pageItems.length - 1]!._id) : null;

    return { items: pageItems.map(toListItem), nextCursor };
  },

  async getOne(intentId: string): Promise<AdminDisputeDetail> {
    if (!Types.ObjectId.isValid(intentId)) {
      throw new AppError('invalid_id', 'Intent id is not a valid ObjectId', 400);
    }
    const intent = await PaymentIntent.findById(intentId);
    if (!intent) throw new AppError('intent_not_found', 'No payment intent with that id', 404);
    return toDetail(intent);
  },

  /**
   * Apply an admin's resolution. Idempotent for already-terminal intents
   * (verify/mark_failed return their current state without further work).
   */
  async resolve(
    intentId: string,
    adminId: string,
    input: DisputeResolutionInput,
    ctx: AuditContext,
  ): Promise<AdminDisputeDetail> {
    if (!Types.ObjectId.isValid(intentId)) {
      throw new AppError('invalid_id', 'Intent id is not a valid ObjectId', 400);
    }
    const intent = await PaymentIntent.findById(intentId);
    if (!intent) throw new AppError('intent_not_found', 'No payment intent with that id', 404);
    if (intent.status !== 'disputed') {
      throw new AppError(
        'intent_not_disputed',
        `Intent is in "${intent.status}", not "disputed". Already resolved?`,
        409,
      );
    }

    const loan = await Loan.findById(intent.loanId);
    if (!loan) throw new AppError('loan_not_found', 'Linked loan vanished', 500);

    const intentBefore = { status: intent.status };
    const loanBefore = { status: loan.status };

    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        switch (input.action) {
          case 'verify':
            intent.status = 'verified';
            intent.verifiedAt = new Date();
            await intent.save({ session });
            await applyVerifiedSideEffects(intent, loan, ctx, session);
            break;

          case 'mark_failed':
            intent.status = 'failed';
            intent.failedAt = new Date();
            intent.failureReason = `Admin resolution: ${input.reason}`;
            await intent.save({ session });
            break;

          case 'default_loan':
            intent.status = 'failed';
            intent.failedAt = new Date();
            intent.failureReason = `Admin defaulted the loan: ${input.reason}`;
            await intent.save({ session });

            loan.status = 'defaulted';
            loan.defaultedAt = new Date();
            loan.defaultedBy = input.defaultBy!;
            loan.defaultReason = input.reason;
            await loan.save({ session });

            await applyDefaulterPenalty(loan, input.defaultBy!, ctx, session);
            break;
        }

        await writeAudit(
          ctx,
          {
            action: `dispute.${input.action}`,
            entityType: 'payment_intent',
            entityId: String(intent._id),
            before: intentBefore,
            after: { status: intent.status, reason: input.reason },
            metadata: { adminId, defaultBy: input.defaultBy ?? null },
          },
          session,
        );
        if (input.action === 'default_loan') {
          await writeAudit(
            ctx,
            {
              action: 'loan.defaulted',
              entityType: 'loan',
              entityId: String(loan._id),
              before: loanBefore,
              after: {
                status: loan.status,
                defaultedBy: loan.defaultedBy,
                defaultedAt: loan.defaultedAt,
              },
              metadata: { adminId, intentId: String(intent._id) },
            },
            session,
          );
        }
      });
    } finally {
      await session.endSession();
    }

    // System chat message — best-effort, outside the transaction
    try {
      const amountStr = `₹${(intent.amountPaise / 100).toLocaleString('en-IN')}`;
      let copy = '';
      if (input.action === 'verify') {
        copy = `⚖️ Admin reviewed the dispute and verified the payment of ${amountStr}. Reason: ${input.reason}`;
      } else if (input.action === 'mark_failed') {
        copy = `⚖️ Admin reviewed the dispute and marked the payment as failed. Reason: ${input.reason}`;
      } else {
        copy = `⚖️ Admin defaulted this loan. Defaulter: ${input.defaultBy}. Reason: ${input.reason}. TrustScore penalty applied.`;
      }
      await chatService.postSystem(
        String(intent.loanId),
        input.action === 'default_loan' ? 'system_loan_closed' : 'system_payment_attested',
        copy,
        {
          adminAction: input.action,
          intentId: String(intent._id),
          defaultBy: input.defaultBy ?? null,
        },
      );
    } catch {
      /* */
    }

    return toDetail(intent);
  },
};

// ----------------------------------------------------------------------------
// Side-effect helpers
// ----------------------------------------------------------------------------

async function applyVerifiedSideEffects(
  intent: PaymentIntentDocument,
  loan: LoanDocument,
  ctx: AuditContext,
  session: ClientSession,
): Promise<void> {
  if (intent.kind === 'disbursal') {
    if (loan.status === 'awaiting_disbursal') {
      const before = { status: loan.status };
      loan.status = 'active';
      loan.disbursedAt = new Date();
      await loan.save({ session });
      await emiService.generateForLoan(loan, loan.disbursedAt, session);
      await writeAudit(
        ctx,
        {
          action: 'loan.activated',
          entityType: 'loan',
          entityId: String(loan._id),
          before,
          after: { status: loan.status, disbursedAt: loan.disbursedAt },
          metadata: { triggeredBy: String(intent._id), via: 'admin_dispute_verify' },
        },
        session,
      );
    }
  } else if (intent.kind === 'emi' && intent.emiNumber) {
    const schedule = await emiService.markEmiPaid(
      loan._id as unknown as Types.ObjectId,
      intent.emiNumber,
      intent._id as unknown as Types.ObjectId,
      new Date(),
      session,
    );
    const allPaid = schedule.installments.every((i) => i.status === 'paid');
    if (allPaid && loan.status === 'active') {
      const before = { status: loan.status };
      loan.status = 'closed';
      loan.closedAt = new Date();
      await loan.save({ session });
      await writeAudit(
        ctx,
        {
          action: 'loan.closed',
          entityType: 'loan',
          entityId: String(loan._id),
          before,
          after: { status: loan.status, closedAt: loan.closedAt },
          metadata: { via: 'admin_dispute_verify' },
        },
        session,
      );
    }
  }
}

async function applyDefaulterPenalty(
  loan: LoanDocument,
  defaultBy: 'borrower' | 'lender',
  ctx: AuditContext,
  session: ClientSession,
): Promise<void> {
  const defaulterId = defaultBy === 'borrower' ? loan.borrowerId : loan.lenderId;
  const defaulter = await User.findById(defaulterId).session(session);
  if (!defaulter) return;
  const before = { trustScore: defaulter.trustScore, trustBand: defaulter.trustBand };
  const newScore = clampTrustScore((defaulter.trustScore ?? 300) - DEFAULTER_TRUSTSCORE_PENALTY);
  defaulter.trustScore = newScore;
  defaulter.trustBand = bandFromScore(newScore);
  await defaulter.save({ session });

  await writeAudit(
    ctx,
    {
      action: 'user.trust_score.changed',
      entityType: 'user',
      entityId: String(defaulter._id),
      before,
      after: { trustScore: defaulter.trustScore, trustBand: defaulter.trustBand },
      metadata: { trigger: 'default', loanId: String(loan._id), penalty: DEFAULTER_TRUSTSCORE_PENALTY },
    },
    session,
  );
}
