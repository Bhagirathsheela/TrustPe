/**
 * Payment service — disbursal + EMI lifecycle.
 *
 * Three flows:
 *   1. initiateDisbursal — lender creates a disbursal intent
 *   2. initiateEmiPayment — borrower creates an EMI payment intent
 *   3. submitPayerEvidence / submitAttestation — verification loop
 *
 * Verification is asymmetric per architecture:
 *   - Payer marks the payment (UTR optional in Phase 1) → status='payer_confirmed'
 *   - Receiver attests received → status='verified'
 *   - If receiver attests not_received → status='disputed' (admin review)
 *
 * On verified disbursal: Loan moves to 'active' and EMI schedule is generated.
 * On verified final EMI: Loan moves to 'closed'.
 *
 * Every state change writes audit entries and a system message in the
 * loan's chat thread.
 */
import { Types, startSession, type ClientSession } from 'mongoose';
import type {
  InitiateEmiPaymentInput,
  PayerEvidenceInput,
  PayerFailureInput,
  ReceiverAttestationInput,
} from 'trustpe-shared';
import { PaymentIntent, type PaymentIntentDocument } from '../models/PaymentIntent.js';
import { Loan, type LoanDocument } from '../models/Loan.js';
import { KycRecord } from '../models/KycRecord.js';
import { EmiSchedule } from '../models/EmiSchedule.js';
import { AppError } from '../middleware/error-handler.js';
import { writeAudit, type AuditContext } from '../utils/audit.js';
import { chatService } from './chat.service.js';
import { notificationService } from './notification.service.js';
import { emiService } from './emi.service.js';

const INTENT_TTL_DAYS = 7;

export type PaymentIntentPayload = {
  id: string;
  loanId: string;
  kind: 'disbursal' | 'emi' | 'preclose';
  emiNumber?: number;
  payerId: string;
  payeeId: string;
  payerVpa: string;
  payeeVpa: string;
  payeeName: string;
  amountPaise: number;
  referenceId: string;
  status: string;
  payerEvidence?: {
    utr?: string;
    amountConfirmed?: boolean;
    note?: string;
    submittedAt?: string;
  };
  receiverAttestation?: {
    decision: 'received' | 'not_received';
    reason?: string;
    submittedAt?: string;
  };
  failureReason?: string;
  /** Pre-built upi://pay URL the mobile fires via Linking. */
  upiUrl: string;
  createdAt: string;
  expiresAt: string;
  payerConfirmedAt?: string;
  verifiedAt?: string;
  failedAt?: string;
};

function buildUpiUrl(intent: PaymentIntentDocument): string {
  const amountRupees = (intent.amountPaise / 100).toFixed(2);
  const params = new URLSearchParams({
    pa: intent.payeeVpa,
    pn: intent.payeeName,
    am: amountRupees,
    cu: 'INR',
    tn:
      intent.kind === 'disbursal'
        ? `TrustPe disbursal ${intent.referenceId.slice(0, 8)}`
        : intent.kind === 'emi'
          ? `TrustPe EMI ${intent.emiNumber}/${intent.referenceId.slice(0, 8)}`
          : `TrustPe ${intent.kind}`,
    tr: intent.referenceId,
  });
  return `upi://pay?${params.toString()}`;
}

function toPayload(intent: PaymentIntentDocument): PaymentIntentPayload {
  return {
    id: String(intent._id),
    loanId: String(intent.loanId),
    kind: intent.kind,
    emiNumber: intent.emiNumber ?? undefined,
    payerId: String(intent.payerId),
    payeeId: String(intent.payeeId),
    payerVpa: intent.payerVpa,
    payeeVpa: intent.payeeVpa,
    payeeName: intent.payeeName,
    amountPaise: intent.amountPaise,
    referenceId: intent.referenceId,
    status: intent.status,
    payerEvidence: intent.payerEvidence
      ? {
          utr: intent.payerEvidence.utr ?? undefined,
          amountConfirmed: intent.payerEvidence.amountConfirmed ?? undefined,
          note: intent.payerEvidence.note ?? undefined,
          submittedAt: intent.payerEvidence.submittedAt?.toISOString(),
        }
      : undefined,
    receiverAttestation: intent.receiverAttestation
      ? {
          decision: intent.receiverAttestation.decision,
          reason: intent.receiverAttestation.reason ?? undefined,
          submittedAt: intent.receiverAttestation.submittedAt?.toISOString(),
        }
      : undefined,
    failureReason: intent.failureReason ?? undefined,
    upiUrl: buildUpiUrl(intent),
    createdAt: intent.createdAt.toISOString(),
    expiresAt: intent.expiresAt.toISOString(),
    payerConfirmedAt: intent.payerConfirmedAt?.toISOString(),
    verifiedAt: intent.verifiedAt?.toISOString(),
    failedAt: intent.failedAt?.toISOString(),
  };
}

async function loadLoanVpas(
  loan: LoanDocument,
): Promise<{ borrowerVpa: string; lenderVpa: string }> {
  // Borrower VPA lives on their KYC record; lender VPA lives on theirs.
  const [borrowerKyc, lenderKyc] = await Promise.all([
    KycRecord.findOne({ userId: loan.borrowerId }),
    KycRecord.findOne({ userId: loan.lenderId }),
  ]);
  if (!borrowerKyc?.vpa) {
    throw new AppError('borrower_vpa_missing', "Borrower's UPI ID is not on file.", 409);
  }
  if (!lenderKyc?.vpa) {
    throw new AppError('lender_vpa_missing', "Lender's UPI ID is not on file.", 409);
  }
  return { borrowerVpa: borrowerKyc.vpa, lenderVpa: lenderKyc.vpa };
}

export const paymentService = {
  /**
   * Lender starts the disbursal. One open disbursal intent per loan; if one
   * exists already (and isn't terminal) we return that instead of creating
   * a second. The mobile fires the returned upiUrl via Linking.
   */
  async initiateDisbursal(
    lenderId: string,
    loanId: string,
    ctx: AuditContext,
  ): Promise<PaymentIntentPayload> {
    if (!Types.ObjectId.isValid(loanId)) {
      throw new AppError('invalid_id', 'Loan id is not a valid ObjectId', 400);
    }
    const loan = await Loan.findById(loanId);
    if (!loan) throw new AppError('loan_not_found', 'No loan with that id', 404);
    if (String(loan.lenderId) !== lenderId) {
      throw new AppError('not_lender', 'Only the lender can disburse this loan.', 403);
    }
    if (loan.status !== 'awaiting_disbursal') {
      throw new AppError(
        'wrong_loan_state',
        `Loan is in "${loan.status}", not "awaiting_disbursal".`,
        409,
      );
    }

    // Reuse an existing open disbursal intent rather than spinning up a second.
    const existing = await PaymentIntent.findOne({
      loanId,
      kind: 'disbursal',
      status: { $in: ['awaiting_payer_evidence', 'payer_confirmed'] },
    });
    if (existing) return toPayload(existing);

    const { borrowerVpa, lenderVpa } = await loadLoanVpas(loan);
    const expiresAt = new Date(Date.now() + INTENT_TTL_DAYS * 24 * 60 * 60 * 1000);

    let intent: PaymentIntentDocument | undefined;
    try {
      [intent] = await PaymentIntent.create([
        {
          loanId: loan._id,
          kind: 'disbursal',
          payerId: loan.lenderId,
          payeeId: loan.borrowerId,
          payerVpa: lenderVpa,
          payeeVpa: borrowerVpa,
          payeeName: loan.borrowerSnapshot.name,
          amountPaise: loan.amountPaise,
          status: 'awaiting_payer_evidence',
          expiresAt,
        },
      ]);
    } catch (err) {
      // Concurrent initiation lost the partial-unique-index race — return the
      // winner's intent instead (same behaviour as the findOne pre-check).
      if ((err as { code?: number }).code === 11000) {
        const winner = await PaymentIntent.findOne({
          loanId,
          kind: 'disbursal',
          status: { $in: ['awaiting_payer_evidence', 'payer_confirmed'] },
        });
        if (winner) return toPayload(winner);
      }
      throw err;
    }
    if (!intent) throw new AppError('create_failed', 'Failed to create disbursal intent', 500);

    await writeAudit(ctx, {
      action: 'payment.disbursal_initiated',
      entityType: 'payment_intent',
      entityId: String(intent._id),
      after: { status: intent.status, amountPaise: intent.amountPaise },
    });

    try {
      await chatService.postSystem(
        String(loan._id),
        'system_disbursal',
        `Lender initiated UPI disbursal of ₹${(intent.amountPaise / 100).toLocaleString('en-IN')}. Awaiting payment.`,
        { intentId: String(intent._id), referenceId: intent.referenceId },
      );
    } catch {
      /* chat is non-critical */
    }
    notificationService.enqueue(
      String(loan.borrowerId),
      'disbursal_initiated',
      'Lender is disbursing your loan',
      `${loan.lenderSnapshot.name} started UPI disbursal of ₹${(intent.amountPaise / 100).toLocaleString('en-IN')}.`,
      { deepLink: `/payments/${intent._id}` },
    );

    return toPayload(intent);
  },

  /**
   * Borrower starts an EMI payment for a specific installment number.
   * Validates the EMI is pending and not already in a non-terminal intent.
   */
  async initiateEmiPayment(
    borrowerId: string,
    loanId: string,
    input: InitiateEmiPaymentInput,
    ctx: AuditContext,
  ): Promise<PaymentIntentPayload> {
    if (!Types.ObjectId.isValid(loanId)) {
      throw new AppError('invalid_id', 'Loan id is not a valid ObjectId', 400);
    }
    const loan = await Loan.findById(loanId);
    if (!loan) throw new AppError('loan_not_found', 'No loan with that id', 404);
    if (String(loan.borrowerId) !== borrowerId) {
      throw new AppError('not_borrower', 'Only the borrower can pay this EMI.', 403);
    }
    if (loan.status !== 'active') {
      throw new AppError(
        'wrong_loan_state',
        `Loan is in "${loan.status}", not "active".`,
        409,
      );
    }

    const schedule = await EmiSchedule.findOne({ loanId });
    if (!schedule) {
      throw new AppError('schedule_not_generated', 'EMI schedule missing for this loan.', 500);
    }
    const installment = schedule.installments.find((i) => i.emiNumber === input.emiNumber);
    if (!installment) {
      throw new AppError('emi_not_found', `EMI #${input.emiNumber} not in schedule.`, 404);
    }
    if (installment.status === 'paid') {
      throw new AppError(
        'emi_already_paid',
        `EMI #${input.emiNumber} is already settled.`,
        409,
      );
    }

    const existing = await PaymentIntent.findOne({
      loanId,
      kind: 'emi',
      emiNumber: input.emiNumber,
      status: { $in: ['awaiting_payer_evidence', 'payer_confirmed'] },
    });
    if (existing) return toPayload(existing);

    const { borrowerVpa, lenderVpa } = await loadLoanVpas(loan);
    const expiresAt = new Date(Date.now() + INTENT_TTL_DAYS * 24 * 60 * 60 * 1000);

    let intent: PaymentIntentDocument | undefined;
    try {
      [intent] = await PaymentIntent.create([
        {
          loanId: loan._id,
          kind: 'emi',
          emiNumber: input.emiNumber,
          payerId: loan.borrowerId,
          payeeId: loan.lenderId,
          payerVpa: borrowerVpa,
          payeeVpa: lenderVpa,
          payeeName: loan.lenderSnapshot.name,
          amountPaise: installment.amountPaise,
          status: 'awaiting_payer_evidence',
          expiresAt,
        },
      ]);
    } catch (err) {
      // Concurrent initiation lost the partial-unique-index race — return the
      // winner's intent instead (same behaviour as the findOne pre-check).
      if ((err as { code?: number }).code === 11000) {
        const winner = await PaymentIntent.findOne({
          loanId,
          kind: 'emi',
          emiNumber: input.emiNumber,
          status: { $in: ['awaiting_payer_evidence', 'payer_confirmed'] },
        });
        if (winner) return toPayload(winner);
      }
      throw err;
    }
    if (!intent) throw new AppError('create_failed', 'Failed to create EMI intent', 500);

    await writeAudit(ctx, {
      action: 'payment.emi_initiated',
      entityType: 'payment_intent',
      entityId: String(intent._id),
      after: {
        status: intent.status,
        amountPaise: intent.amountPaise,
        emiNumber: input.emiNumber,
      },
    });

    try {
      await chatService.postSystem(
        String(loan._id),
        'system_payment_marked',
        `Borrower initiated EMI #${input.emiNumber} of ₹${(intent.amountPaise / 100).toLocaleString('en-IN')}. Awaiting payment.`,
        { intentId: String(intent._id), referenceId: intent.referenceId, emiNumber: input.emiNumber },
      );
    } catch {
      /* chat is non-critical */
    }

    return toPayload(intent);
  },

  /** Payer marks the payment as sent (with optional UTR). */
  async submitPayerEvidence(
    intentId: string,
    viewerId: string,
    input: PayerEvidenceInput,
    ctx: AuditContext,
  ): Promise<PaymentIntentPayload> {
    if (!Types.ObjectId.isValid(intentId)) {
      throw new AppError('invalid_id', 'Intent id is not a valid ObjectId', 400);
    }
    const intent = await PaymentIntent.findById(intentId);
    if (!intent) throw new AppError('intent_not_found', 'No payment intent with that id', 404);
    if (String(intent.payerId) !== viewerId) {
      throw new AppError('not_payer', 'Only the payer can submit payment evidence.', 403);
    }
    if (intent.status !== 'awaiting_payer_evidence') {
      throw new AppError(
        'wrong_intent_state',
        `Intent is in "${intent.status}".`,
        409,
      );
    }
    if (intent.expiresAt < new Date()) {
      throw new AppError(
        'intent_expired',
        'This payment intent has expired. Please initiate the payment again.',
        409,
      );
    }

    const before = { status: intent.status };
    intent.status = 'payer_confirmed';
    intent.payerEvidence = {
      utr: input.utr,
      amountConfirmed: input.amountConfirmed,
      note: input.note,
      submittedAt: new Date(),
      ip: ctx.ip,
      deviceFingerprint: undefined,
    };
    intent.payerConfirmedAt = new Date();
    await intent.save();

    await writeAudit(ctx, {
      action: 'payment.payer_confirmed',
      entityType: 'payment_intent',
      entityId: String(intent._id),
      before,
      after: { status: intent.status, utr: input.utr ?? null },
    });

    try {
      const amountStr = `₹${(intent.amountPaise / 100).toLocaleString('en-IN')}`;
      const label =
        intent.kind === 'disbursal' ? 'Disbursal' : `EMI #${intent.emiNumber}`;
      const utrLine = input.utr ? ` UTR ${input.utr}.` : '';
      await chatService.postSystem(
        String(intent.loanId),
        'system_payment_marked',
        `${label} of ${amountStr} marked as sent by payer.${utrLine} Awaiting receiver confirmation.`,
        { intentId: String(intent._id), utr: input.utr ?? null },
      );
    } catch {
      /* */
    }
    notificationService.enqueue(
      String(intent.payeeId),
      'attest_needed',
      'Confirm receipt of payment',
      `Payer marked ₹${(intent.amountPaise / 100).toLocaleString('en-IN')} sent. Open to confirm or dispute.`,
      { deepLink: `/payments/${intent._id}` },
    );

    return toPayload(intent);
  },

  /** Payer marks the payment as failed (UPI app reported failure). */
  async submitPayerFailure(
    intentId: string,
    viewerId: string,
    input: PayerFailureInput,
    ctx: AuditContext,
  ): Promise<PaymentIntentPayload> {
    if (!Types.ObjectId.isValid(intentId)) {
      throw new AppError('invalid_id', 'Intent id is not a valid ObjectId', 400);
    }
    const intent = await PaymentIntent.findById(intentId);
    if (!intent) throw new AppError('intent_not_found', 'No payment intent with that id', 404);
    if (String(intent.payerId) !== viewerId) {
      throw new AppError('not_payer', 'Only the payer can mark this failed.', 403);
    }
    if (intent.status !== 'awaiting_payer_evidence') {
      throw new AppError('wrong_intent_state', `Intent is in "${intent.status}".`, 409);
    }

    const before = { status: intent.status };
    intent.status = 'failed';
    intent.failureReason = input.reason;
    intent.failedAt = new Date();
    await intent.save();

    await writeAudit(ctx, {
      action: 'payment.failed',
      entityType: 'payment_intent',
      entityId: String(intent._id),
      before,
      after: { status: intent.status, reason: input.reason },
    });

    try {
      await chatService.postSystem(
        String(intent.loanId),
        'system_payment_marked',
        `Payer marked the payment as failed: ${input.reason}`,
        { intentId: String(intent._id) },
      );
    } catch {
      /* */
    }

    return toPayload(intent);
  },

  /**
   * Receiver attests received / not_received.
   *
   * On 'received':
   *   - Intent → 'verified'
   *   - If disbursal: Loan → 'active', generate EMI schedule
   *   - If final EMI: Loan → 'closed'
   *   - If non-final EMI: mark installment paid
   *
   * On 'not_received':
   *   - Intent → 'disputed' (admin review picks it up — handled in a future sprint)
   */
  async submitAttestation(
    intentId: string,
    viewerId: string,
    input: ReceiverAttestationInput,
    ctx: AuditContext,
  ): Promise<PaymentIntentPayload> {
    if (!Types.ObjectId.isValid(intentId)) {
      throw new AppError('invalid_id', 'Intent id is not a valid ObjectId', 400);
    }
    const intent = await PaymentIntent.findById(intentId);
    if (!intent) throw new AppError('intent_not_found', 'No payment intent with that id', 404);
    if (String(intent.payeeId) !== viewerId) {
      throw new AppError('not_payee', 'Only the receiver can attest.', 403);
    }
    if (intent.status !== 'payer_confirmed') {
      throw new AppError('wrong_intent_state', `Intent is in "${intent.status}".`, 409);
    }

    const before = { status: intent.status };
    const attestation = {
      decision: input.decision,
      reason: input.reason,
      submittedAt: new Date(),
      ip: ctx.ip,
    };
    const nextStatus = input.decision === 'not_received' ? ('disputed' as const) : ('verified' as const);

    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        // Atomic claim: only ONE caller can move payer_confirmed → next
        // state. A concurrent attestation (double-tap, two devices) loses
        // the claim and gets a clean 409 instead of double-applying the
        // verified side-effects.
        const fresh = await PaymentIntent.findOneAndUpdate(
          { _id: intent._id, status: 'payer_confirmed' },
          {
            $set: {
              status: nextStatus,
              receiverAttestation: attestation,
              ...(nextStatus === 'verified' ? { verifiedAt: new Date() } : {}),
            },
          },
          { new: true, session },
        );
        if (!fresh) {
          throw new AppError('wrong_intent_state', 'This payment was already attested.', 409);
        }

        if (nextStatus === 'verified') {
          // Apply the side-effects on Loan + EmiSchedule.
          const loan = await Loan.findById(fresh.loanId).session(session);
          if (!loan) throw new AppError('loan_not_found', 'Loan vanished', 404);

          if (fresh.kind === 'disbursal') {
            await applyVerifiedDisbursal(loan, fresh, ctx, session);
          } else if (fresh.kind === 'emi') {
            await applyVerifiedEmi(loan, fresh, ctx, session);
          }
        }

        // Mirror the committed state onto the in-memory doc for toPayload()
        // and the post-transaction chat/notification block below.
        intent.status = fresh.status;
        intent.receiverAttestation = fresh.receiverAttestation;
        intent.verifiedAt = fresh.verifiedAt;

        await writeAudit(
          ctx,
          {
            action: `payment.${input.decision === 'received' ? 'verified' : 'disputed'}`,
            entityType: 'payment_intent',
            entityId: String(intent._id),
            before,
            after: { status: intent.status, decision: input.decision },
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    // System chat message — best effort outside the transaction
    try {
      const amountStr = `₹${(intent.amountPaise / 100).toLocaleString('en-IN')}`;
      if (input.decision === 'received') {
        if (intent.kind === 'disbursal') {
          await chatService.postSystem(
            String(intent.loanId),
            'system_payment_attested',
            `✓ Borrower confirmed receipt of ${amountStr}. Loan is now active. EMI schedule is generated.`,
            { intentId: String(intent._id) },
          );
          notificationService.enqueue(
            String(intent.payerId),
            'loan_active',
            '✓ Loan is now active',
            `Borrower confirmed receipt of ${amountStr}. EMI schedule has been generated.`,
            { deepLink: `/loans/${intent.loanId}` },
          );
        } else if (intent.kind === 'emi') {
          await chatService.postSystem(
            String(intent.loanId),
            'system_payment_attested',
            `✓ Lender confirmed receipt of EMI #${intent.emiNumber} (${amountStr}).`,
            { intentId: String(intent._id), emiNumber: intent.emiNumber },
          );
          notificationService.enqueue(
            String(intent.payerId),
            'payment_verified',
            `✓ EMI #${intent.emiNumber} confirmed`,
            `Lender confirmed receipt of ${amountStr}.`,
            { deepLink: `/loans/${intent.loanId}` },
          );
          // If this verification closed the loan, prompt both parties to
          // leave a review. The post-transaction read of intent.loanId is
          // safe because we've already saved the new loan state.
          const closedLoan = await Loan.findById(intent.loanId);
          if (closedLoan?.status === 'closed') {
            try {
              await chatService.postSystem(
                String(intent.loanId),
                'system_loan_closed',
                `🎉 Loan completed! All ${closedLoan.tenureMonths} EMI${closedLoan.tenureMonths > 1 ? 's' : ''} paid. Please rate your experience — both reviews will impact each party's TrustScore.`,
                { promptReview: true },
              );
            } catch {
              /* */
            }
            // Prompt both parties to leave a review.
            notificationService.enqueue(
              String(closedLoan.borrowerId),
              'loan_closed',
              '🎉 Loan completed — rate your lender',
              `All ${closedLoan.tenureMonths} EMI${closedLoan.tenureMonths > 1 ? 's' : ''} paid. Your review impacts their TrustScore.`,
              { deepLink: `/reviews/new?loanId=${closedLoan._id}` },
            );
            notificationService.enqueue(
              String(closedLoan.lenderId),
              'loan_closed',
              '🎉 Loan completed — rate your borrower',
              `Final EMI received. Your review impacts their TrustScore.`,
              { deepLink: `/reviews/new?loanId=${closedLoan._id}` },
            );
          }
        }
      } else {
        await chatService.postSystem(
          String(intent.loanId),
          'system_payment_attested',
          `⚠️ Receiver said they did NOT receive ${amountStr}.${input.reason ? ` Reason: ${input.reason}` : ''} Admin will review.`,
          { intentId: String(intent._id) },
        );
        notificationService.enqueue(
          String(intent.payerId),
          'dispute_opened',
          '⚠️ Payment disputed',
          `Receiver says they didn't get ${amountStr}. TrustPe admin will review.`,
          { deepLink: `/payments/${intent._id}` },
        );
      }
    } catch {
      /* */
    }

    return toPayload(intent);
  },

  async getOne(intentId: string, viewerId: string): Promise<PaymentIntentPayload> {
    if (!Types.ObjectId.isValid(intentId)) {
      throw new AppError('invalid_id', 'Intent id is not a valid ObjectId', 400);
    }
    const intent = await PaymentIntent.findById(intentId);
    if (!intent) throw new AppError('intent_not_found', 'No payment intent with that id', 404);
    if (String(intent.payerId) !== viewerId && String(intent.payeeId) !== viewerId) {
      throw new AppError('forbidden', 'Not your payment.', 403);
    }
    return toPayload(intent);
  },

  /** All payments on one loan. Borrower or lender can list. */
  async listForLoan(loanId: string, viewerId: string): Promise<PaymentIntentPayload[]> {
    if (!Types.ObjectId.isValid(loanId)) {
      throw new AppError('invalid_id', 'Loan id is not a valid ObjectId', 400);
    }
    const loan = await Loan.findById(loanId);
    if (!loan) throw new AppError('loan_not_found', 'No loan with that id', 404);
    if (String(loan.borrowerId) !== viewerId && String(loan.lenderId) !== viewerId) {
      throw new AppError('forbidden', 'Not your loan.', 403);
    }
    const intents = await PaymentIntent.find({ loanId }).sort({ createdAt: -1 });
    return intents.map(toPayload);
  },
};

// -----------------------------------------------------------------------------
// State-transition helpers
// -----------------------------------------------------------------------------

async function applyVerifiedDisbursal(
  loan: LoanDocument,
  intent: PaymentIntentDocument,
  ctx: AuditContext,
  session: ClientSession,
): Promise<void> {
  const before = { status: loan.status };
  loan.status = 'active';
  loan.disbursedAt = new Date();
  await loan.save({ session });

  // Generate EMI schedule starting from disbursal date.
  await emiService.generateForLoan(loan, loan.disbursedAt, session);

  await writeAudit(
    ctx,
    {
      action: 'loan.activated',
      entityType: 'loan',
      entityId: String(loan._id),
      before,
      after: { status: loan.status, disbursedAt: loan.disbursedAt },
      metadata: { triggeredBy: String(intent._id) },
    },
    session,
  );
}

async function applyVerifiedEmi(
  loan: LoanDocument,
  intent: PaymentIntentDocument,
  ctx: AuditContext,
  session: ClientSession,
): Promise<void> {
  const emiNumber = intent.emiNumber;
  if (!emiNumber) {
    throw new AppError('emi_number_missing', 'EMI intent missing emiNumber', 500);
  }
  const schedule = await emiService.markEmiPaid(
    loan._id as unknown as Types.ObjectId,
    emiNumber,
    intent._id as unknown as Types.ObjectId,
    new Date(),
    session,
  );

  const allPaid = schedule.installments.every((i) => i.status === 'paid');
  if (allPaid) {
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
      },
      session,
    );
  }
}
