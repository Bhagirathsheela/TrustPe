/**
 * Agreement service — generate, fetch, sign.
 *
 * Lifecycle:
 *   - Lazy-created on first GET, OR auto-created at loan creation (we go
 *     with the latter — see loan-offer.service.fund())
 *   - Mobile renders bodyText, user scrolls to bottom + taps Accept
 *   - POST /sign records the signature with IP + device fingerprint + hash
 *   - When both sides have signed, Agreement.status → 'signed',
 *     Loan.status → 'awaiting_disbursal', system message posted in chat
 *
 * The body is a deterministic function of loan + party snapshots, so two
 * generations of the same loan produce the same hash. The hash is the
 * tamper-evident audit hook.
 */
import crypto from 'node:crypto';
import { Types, startSession } from 'mongoose';
import { Agreement, type AgreementDocument } from '../models/Agreement.js';
import { Loan, type LoanDocument } from '../models/Loan.js';
import { AppError } from '../middleware/error-handler.js';
import { writeAudit, type AuditContext } from '../utils/audit.js';
import { chatService } from './chat.service.js';
import { notificationService } from './notification.service.js';
import type { SignAgreementInput } from 'trustpe-shared';

export type AgreementPayload = {
  id: string;
  loanId: string;
  borrowerId: string;
  lenderId: string;
  bodyText: string;
  bodyHash: string;
  status: string;
  borrowerSignature?: SignaturePayload;
  lenderSignature?: SignaturePayload;
  generatedAt: string;
  signedAt?: string;
};

export type SignaturePayload = {
  userId: string;
  signedAt: string;
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  bodyHash: string;
};

function toSigPayload(s: NonNullable<AgreementDocument['borrowerSignature']>): SignaturePayload {
  return {
    userId: String(s.userId),
    signedAt: s.signedAt.toISOString(),
    ip: s.ip ?? undefined,
    userAgent: s.userAgent ?? undefined,
    deviceFingerprint: s.deviceFingerprint ?? undefined,
    bodyHash: s.bodyHash,
  };
}

function toPayload(a: AgreementDocument): AgreementPayload {
  return {
    id: String(a._id),
    loanId: String(a.loanId),
    borrowerId: String(a.borrowerId),
    lenderId: String(a.lenderId),
    bodyText: a.bodyText,
    bodyHash: a.bodyHash,
    status: a.status,
    borrowerSignature: a.borrowerSignature ? toSigPayload(a.borrowerSignature) : undefined,
    lenderSignature: a.lenderSignature ? toSigPayload(a.lenderSignature) : undefined,
    generatedAt: a.generatedAt.toISOString(),
    signedAt: a.signedAt?.toISOString(),
  };
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

/** Simple-interest EMI math — same as the mobile fund confirmation card. */
function emiCalc(amountPaise: number, roiPercent: number, tenureMonths: number) {
  const totalInterest = Math.round((amountPaise * roiPercent * tenureMonths) / (100 * 12));
  const totalAmount = amountPaise + totalInterest;
  const monthlyEmi = Math.round(totalAmount / tenureMonths);
  return { totalInterest, totalAmount, monthlyEmi };
}

/**
 * Generate the canonical agreement body. Deterministic by design — same
 * loan → same string → same hash. Don't include any clock-dependent
 * values here.
 */
function generateBodyText(loan: LoanDocument): string {
  const principalStr = formatRupees(loan.amountPaise);
  const { totalInterest, totalAmount, monthlyEmi } = emiCalc(
    loan.amountPaise,
    loan.roiPercent,
    loan.tenureMonths,
  );

  return `
PERSONAL LOAN AGREEMENT

This Personal Loan Agreement ("Agreement") is entered into between:

LENDER:
  Name: ${loan.lenderSnapshot.name}
  City: ${loan.lenderSnapshot.city ?? 'Not on record'}
  TrustScore at agreement: ${loan.lenderSnapshot.trustScore} (${loan.lenderSnapshot.trustBand})

BORROWER:
  Name: ${loan.borrowerSnapshot.name}
  City: ${loan.borrowerSnapshot.city ?? 'Not on record'}
  TrustScore at agreement: ${loan.borrowerSnapshot.trustScore} (${loan.borrowerSnapshot.trustBand})

LOAN TERMS:
  Principal amount:    ${principalStr}
  Tenure:              ${loan.tenureMonths} month${loan.tenureMonths > 1 ? 's' : ''}
  Interest rate:       ${loan.roiPercent}% per annum (simple interest)
  Total interest:      ${formatRupees(totalInterest)}
  Total repayable:     ${formatRupees(totalAmount)}
  Monthly EMI:         ${formatRupees(monthlyEmi)}

1. NATURE OF AGREEMENT
   This is a personal loan between two private individuals. TrustPe is a
   trust-based matching and record-keeping platform; TrustPe is not a
   party to this loan and does not guarantee performance by either party.

2. DISBURSAL AND REPAYMENT
   The Lender will disburse the Principal amount to the Borrower via UPI
   transfer to the Borrower's registered UPI ID. The Borrower undertakes
   to repay the Total repayable amount as ${loan.tenureMonths} monthly EMI
   instalment${loan.tenureMonths > 1 ? 's' : ''} of ${formatRupees(monthlyEmi)} each, payable on or
   before the same day of each calendar month following disbursal.

3. INTEREST CALCULATION
   Interest is computed on a simple-interest basis at the rate of
   ${loan.roiPercent}% per annum on the Principal amount, over the agreed
   Tenure. No compounding, late fees, or additional charges are payable
   unless explicitly agreed in writing.

4. EARLY REPAYMENT
   The Borrower may repay the outstanding amount at any time without
   penalty. Early repayment reduces the total interest payable
   proportionally.

5. DEFAULT
   If the Borrower fails to pay any EMI within fifteen (15) days of its
   due date, the Lender may report the default to the TrustPe platform's
   public defaulters register and pursue lawful recovery.

6. GOVERNING LAW AND JURISDICTION
   This Agreement is governed by the laws of India. Both Parties submit
   to the exclusive jurisdiction of the courts in the Borrower's state of
   residence for any disputes arising out of this Agreement.

7. ELECTRONIC SIGNATURE
   This Agreement is executed electronically through TrustPe in
   accordance with §10A of the Information Technology Act, 2000. Each
   Party's affirmative click on "Accept and sign" within the TrustPe app,
   together with the captured IP address, device fingerprint, timestamp,
   and SHA-256 hash of this document, constitutes a binding signature.

8. ENTIRE AGREEMENT
   This Agreement constitutes the entire understanding between the
   Parties on the subject matter and supersedes all prior oral or written
   communications.

By tapping "Accept and sign" within the TrustPe mobile app, each Party
confirms that they have read, understood, and agree to be legally bound
by the terms of this Agreement.
`.trim();
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

async function fetchOrCreate(loanId: string): Promise<AgreementDocument> {
  let agreement = await Agreement.findOne({ loanId });
  if (agreement) return agreement;

  const loan = await Loan.findById(loanId);
  if (!loan) throw new AppError('loan_not_found', 'No loan with that id', 404);

  const body = generateBodyText(loan);
  const hash = sha256(body);
  const [created] = await Agreement.create([
    {
      loanId: loan._id,
      borrowerId: loan.borrowerId,
      lenderId: loan.lenderId,
      bodyText: body,
      bodyHash: hash,
      status: 'awaiting_signatures',
      generatedAt: new Date(),
    },
  ]);
  if (!created) throw new AppError('create_failed', 'Failed to generate agreement', 500);
  agreement = created;
  return agreement;
}

function assertParty(agreement: AgreementDocument, viewerId: string): 'borrower' | 'lender' {
  if (String(agreement.borrowerId) === viewerId) return 'borrower';
  if (String(agreement.lenderId) === viewerId) return 'lender';
  throw new AppError('forbidden', 'You are not a party to this agreement.', 403);
}

export const agreementService = {
  /** Fetch or lazily create the agreement for a loan. Borrower/lender only. */
  async getForLoan(loanId: string, viewerId: string): Promise<AgreementPayload> {
    if (!Types.ObjectId.isValid(loanId)) {
      throw new AppError('invalid_id', 'Loan id is not a valid ObjectId', 400);
    }
    const agreement = await fetchOrCreate(loanId);
    assertParty(agreement, viewerId);
    return toPayload(agreement);
  },

  /**
   * Sign the agreement. Captures IP + device fingerprint + body hash for
   * the audit record. When both sides have signed, transitions the
   * agreement to 'signed' and the loan to 'awaiting_disbursal' in one
   * transaction, then posts a system chat message.
   *
   * Idempotent: signing twice by the same party returns the existing
   * signature without creating a duplicate.
   */
  async sign(
    loanId: string,
    viewerId: string,
    input: SignAgreementInput,
    ctx: AuditContext,
  ): Promise<AgreementPayload> {
    if (!Types.ObjectId.isValid(loanId)) {
      throw new AppError('invalid_id', 'Loan id is not a valid ObjectId', 400);
    }
    const agreement = await fetchOrCreate(loanId);
    const role = assertParty(agreement, viewerId);
    if (agreement.status === 'signed') {
      return toPayload(agreement); // already done
    }
    if (agreement.status === 'void') {
      throw new AppError('agreement_void', 'This agreement has been voided.', 409);
    }
    if (role === 'borrower' && agreement.borrowerSignature) return toPayload(agreement);
    if (role === 'lender' && agreement.lenderSignature) return toPayload(agreement);

    // Sanity: client-supplied hash (if any) must match server's hash. Tells us
    // the mobile UI rendered the same body the server has on file.
    if (input.expectedBodyHash && input.expectedBodyHash !== agreement.bodyHash) {
      throw new AppError(
        'body_hash_mismatch',
        'The agreement on your device is out of date. Reload and try again.',
        409,
      );
    }

    const signature = {
      userId: new Types.ObjectId(viewerId),
      signedAt: new Date(),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      deviceFingerprint: input.deviceFingerprint,
      bodyHash: agreement.bodyHash,
      traceId: ctx.traceId,
    };

    const session = await startSession();
    try {
      // Operate on a SESSION-FRESH copy of the agreement inside the
      // transaction. The doc fetched above was read outside the session, so
      // two parties signing concurrently would each miss the other's
      // signature and both take the "partial" branch — leaving the agreement
      // stuck in awaiting_* with both signatures present and the loan never
      // moving to awaiting_disbursal. Transactional reads on the same doc
      // produce a WriteConflict on contention, which withTransaction retries;
      // the retry then sees the other signature.
      let finalDoc: AgreementDocument = agreement;
      await session.withTransaction(async () => {
        const fresh = await Agreement.findById(agreement._id).session(session);
        if (!fresh) throw new AppError('agreement_not_found', 'Agreement vanished', 404);
        finalDoc = fresh;
        if (fresh.status === 'signed') return; // other party completed the race
        if (fresh.status === 'void') {
          throw new AppError('agreement_void', 'This agreement has been voided.', 409);
        }
        if (role === 'borrower' && fresh.borrowerSignature) return; // idempotent
        if (role === 'lender' && fresh.lenderSignature) return; // idempotent

        if (role === 'borrower') {
          fresh.borrowerSignature = signature;
        } else {
          fresh.lenderSignature = signature;
        }

        const bothSigned = Boolean(fresh.borrowerSignature && fresh.lenderSignature);

        if (bothSigned) {
          fresh.status = 'signed';
          fresh.signedAt = new Date();

          // Move the loan to awaiting_disbursal
          const loan = await Loan.findById(fresh.loanId).session(session);
          if (loan) {
            const before = { status: loan.status };
            if (loan.status === 'awaiting_agreement') {
              loan.status = 'awaiting_disbursal';
              await loan.save({ session });
              await writeAudit(
                ctx,
                {
                  action: 'loan.agreement_signed',
                  entityType: 'loan',
                  entityId: String(loan._id),
                  before,
                  after: { status: loan.status },
                },
                session,
              );
            }
          }
        } else {
          // Partial: update interim status so the UI can show "waiting for X"
          fresh.status = role === 'borrower' ? 'awaiting_lender' : 'awaiting_borrower';
        }

        await fresh.save({ session });

        await writeAudit(
          ctx,
          {
            action: 'agreement.signed',
            entityType: 'agreement',
            entityId: String(fresh._id),
            after: {
              status: fresh.status,
              signedRole: role,
              bodyHash: fresh.bodyHash,
            },
            metadata: {
              deviceFingerprint: input.deviceFingerprint ?? null,
            },
          },
          session,
        );
      });
      const agreementAfter = finalDoc;

      // System chat messages (best-effort, fire and forget)
      if (agreementAfter.status === 'signed') {
        try {
          await chatService.postSystem(
            String(agreement.loanId),
            'system_loan_signed',
            'Both parties signed the agreement. Lender can now disburse.',
            { agreementId: String(agreement._id), bodyHash: agreement.bodyHash },
          );
        } catch {
          // chat is non-critical
        }
        // Notify both parties that the agreement is now fully signed.
        notificationService.enqueue(
          String(agreement.borrowerId),
          'agreement_signed',
          '✓ Agreement fully signed',
          'Both parties signed. The lender can now disburse.',
          { deepLink: `/loans/${agreement.loanId}` },
        );
        notificationService.enqueue(
          String(agreement.lenderId),
          'agreement_signed',
          '✓ Agreement fully signed',
          "It's time to disburse via UPI to activate the loan.",
          { deepLink: `/loans/${agreement.loanId}` },
        );
      } else {
        // Notify the OTHER party that someone signed and it's their turn.
        const otherPartyId = role === 'borrower' ? agreement.lenderId : agreement.borrowerId;
        notificationService.enqueue(
          String(otherPartyId),
          'agreement_pending',
          'Agreement needs your signature',
          `${role === 'borrower' ? 'The borrower' : 'The lender'} signed. Sign to keep the loan moving.`,
          { deepLink: `/agreement/${agreement.loanId}` },
        );
      }

      return toPayload(agreementAfter);
    } finally {
      await session.endSession();
    }
  },
};
