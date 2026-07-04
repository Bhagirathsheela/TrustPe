/**
 * Loan-offer service — fixed-rate funding.
 *
 * The negotiation engine is gone. A lender taps "Fund this loan" → backend
 * atomically:
 *   1. Locks the LoanRequest via conditional update (status open → matched)
 *      — first-write-wins on concurrent funds; later attempts get 409.
 *   2. Creates a LoanOffer record with status='accepted' (audit trail).
 *   3. Creates the Loan record (status='awaiting_disbursal').
 *   4. Writes audit log entries for each transition.
 *
 * Counter-offers, withdraw, reject, and the thread machinery have been
 * removed. The model still supports the old enums for any legacy dev DB
 * records.
 */
import { Types } from 'mongoose';
import { startSession } from 'mongoose';
import { type FundRequestInput } from 'trustpe-shared';
import { LoanOffer, type LoanOfferDocument } from '../models/LoanOffer.js';
import { LoanRequest } from '../models/LoanRequest.js';
import { Loan, type LoanDocument } from '../models/Loan.js';
import { User, type UserDocument } from '../models/User.js';
import { Profile } from '../models/Profile.js';
import { AppError } from '../middleware/error-handler.js';
import { writeAudit, type AuditContext } from '../utils/audit.js';
import { eligibilityService } from './eligibility.service.js';
import { notificationService } from './notification.service.js';

export type LoanOfferPayload = {
  id: string;
  loanRequestId: string;
  borrowerId: string;
  lenderId: string;
  senderRole: 'lender' | 'borrower';
  senderId: string;
  amountPaise: number;
  tenureMonths: number;
  roiPercent: number;
  message?: string;
  status: string;
  parentOfferId: string | null;
  rootOfferId: string;
  senderSnapshot: {
    name: string;
    city?: string;
    trustScore: number;
    trustBand: string;
  };
  sentAt: string;
  expiresAt: string;
  respondedAt?: string;
  respondedBy?: string;
  responseReason?: string;
  loanId?: string;
};

function toPayload(o: LoanOfferDocument, loanId?: string): LoanOfferPayload {
  return {
    id: String(o._id),
    loanRequestId: String(o.loanRequestId),
    borrowerId: String(o.borrowerId),
    lenderId: String(o.lenderId),
    senderRole: o.senderRole,
    senderId: String(o.senderId),
    amountPaise: o.amountPaise,
    tenureMonths: o.tenureMonths,
    roiPercent: o.roiPercent,
    message: o.message ?? undefined,
    status: o.status,
    parentOfferId: o.parentOfferId ? String(o.parentOfferId) : null,
    rootOfferId: String(o.rootOfferId),
    senderSnapshot: {
      name: o.senderSnapshot.name,
      city: o.senderSnapshot.city ?? undefined,
      trustScore: o.senderSnapshot.trustScore,
      trustBand: o.senderSnapshot.trustBand,
    },
    sentAt: o.sentAt.toISOString(),
    expiresAt: o.expiresAt.toISOString(),
    respondedAt: o.respondedAt?.toISOString(),
    respondedBy: o.respondedBy ? String(o.respondedBy) : undefined,
    responseReason: o.responseReason ?? undefined,
    loanId,
  };
}

function loanToPayload(l: LoanDocument) {
  return {
    id: String(l._id),
    loanRequestId: String(l.loanRequestId),
    acceptedOfferId: String(l.acceptedOfferId),
    borrowerId: String(l.borrowerId),
    lenderId: String(l.lenderId),
    amountPaise: l.amountPaise,
    tenureMonths: l.tenureMonths,
    roiPercent: l.roiPercent,
    status: l.status,
    borrowerSnapshot: {
      name: l.borrowerSnapshot.name,
      city: l.borrowerSnapshot.city ?? undefined,
      trustScore: l.borrowerSnapshot.trustScore,
      trustBand: l.borrowerSnapshot.trustBand,
    },
    lenderSnapshot: {
      name: l.lenderSnapshot.name,
      city: l.lenderSnapshot.city ?? undefined,
      trustScore: l.lenderSnapshot.trustScore,
      trustBand: l.lenderSnapshot.trustBand,
    },
    agreedAt: l.agreedAt.toISOString(),
    disbursedAt: l.disbursedAt?.toISOString(),
    closedAt: l.closedAt?.toISOString(),
    cancelledAt: l.cancelledAt?.toISOString(),
    agreementId: l.agreementId ? String(l.agreementId) : undefined,
  };
}

async function snapshotUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('user_not_found', 'User no longer exists', 404);
  const profile = await Profile.findOne({ userId });
  return {
    user,
    snapshot: {
      name: user.name,
      city: profile?.city ?? undefined,
      trustScore: user.trustScore ?? 300,
      trustBand: user.trustBand ?? 'building',
    },
  } as const;
}

export const loanOfferService = {
  /**
   * Lender funds a loan request at the borrower's published terms.
   *
   * First-write-wins on concurrent attempts via conditional update on the
   * request's status. Returns the LoanOffer + the newly-created Loan.
   */
  async fund(
    lenderId: string,
    requestId: string,
    input: FundRequestInput,
    ctx: AuditContext,
  ): Promise<{ offer: LoanOfferPayload; loan: ReturnType<typeof loanToPayload> }> {
    if (!Types.ObjectId.isValid(requestId)) {
      throw new AppError('invalid_id', 'Loan request id is not a valid ObjectId', 400);
    }

    const request = await LoanRequest.findById(requestId);
    if (!request) throw new AppError('loan_request_not_found', 'No loan request with that id', 404);
    if (String(request.borrowerId) === lenderId) {
      throw new AppError('cannot_fund_own_request', 'You cannot fund your own request.', 400);
    }
    if (request.status !== 'open') {
      throw new AppError(
        'request_not_open',
        `This request is in "${request.status}" state and can't be funded.`,
        409,
      );
    }
    if (request.expiresAt < new Date()) {
      throw new AppError('request_expired', 'This loan request has expired.', 409);
    }

    const lenderSnapAndUser = await snapshotUser(lenderId);
    const elig = eligibilityService.forLend(lenderSnapAndUser.user);
    if (!elig.ok) {
      throw new AppError(
        elig.reasonCode ?? 'not_eligible',
        elig.reason ?? 'Not eligible to lend',
        400,
      );
    }

    const borrowerSnap = await snapshotUser(String(request.borrowerId));

    // Re-check the BORROWER too — they may have been suspended or had KYC
    // revoked between publishing the request and this fund attempt.
    const borrowerElig = eligibilityService.forBorrow(borrowerSnap.user);
    if (!borrowerElig.ok) {
      throw new AppError(
        'borrower_not_eligible',
        'The borrower is no longer eligible to receive this loan.',
        409,
      );
    }

    const session = await startSession();
    try {
      let createdOffer!: LoanOfferDocument;
      let createdLoan!: LoanDocument;

      await session.withTransaction(async () => {
        // Atomic claim: only succeeds if the request is still open. This
        // serialises concurrent fund attempts cleanly.
        const claimed = await LoanRequest.findOneAndUpdate(
          { _id: requestId, status: 'open', expiresAt: { $gt: new Date() } },
          { $set: { status: 'matched', matchedAt: new Date() } },
          { new: true, session },
        );
        if (!claimed) {
          throw new AppError(
            'request_already_funded',
            'Someone else funded this request first.',
            409,
          );
        }

        // The LoanOffer record is created immediately at accepted status;
        // it doubles as the funding audit row.
        const offerId = new Types.ObjectId();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const [offer] = await LoanOffer.create(
          [
            {
              _id: offerId,
              loanRequestId: claimed._id,
              borrowerId: claimed.borrowerId,
              lenderId,
              senderRole: 'lender',
              senderId: lenderId,
              amountPaise: claimed.amountPaise,
              tenureMonths: claimed.tenureMonths,
              roiPercent: claimed.roiPercent,
              message: input.message,
              status: 'accepted',
              parentOfferId: null,
              rootOfferId: offerId,
              senderSnapshot: lenderSnapAndUser.snapshot,
              sentAt: new Date(),
              expiresAt,
              respondedAt: new Date(),
              respondedBy: lenderId,
            },
          ],
          { session },
        );
        if (!offer) throw new AppError('create_failed', 'Failed to create offer', 500);
        createdOffer = offer;

        const [loan] = await Loan.create(
          [
            {
              loanRequestId: claimed._id,
              acceptedOfferId: offer._id,
              borrowerId: claimed.borrowerId,
              lenderId,
              amountPaise: claimed.amountPaise,
              tenureMonths: claimed.tenureMonths,
              roiPercent: claimed.roiPercent,
              // Newly-funded loans wait for both parties to sign the agreement
              // before moving to awaiting_disbursal. See agreement.service.ts.
              status: 'awaiting_agreement',
              borrowerSnapshot: borrowerSnap.snapshot,
              lenderSnapshot: lenderSnapAndUser.snapshot,
              agreedAt: new Date(),
            },
          ],
          { session },
        );
        if (!loan) throw new AppError('create_failed', 'Failed to create loan', 500);
        createdLoan = loan;

        // Audit entries
        await writeAudit(
          ctx,
          {
            action: 'loan_request.matched',
            entityType: 'loan_request',
            entityId: String(claimed._id),
            after: { status: claimed.status },
          },
          session,
        );
        await writeAudit(
          ctx,
          {
            action: 'loan_offer.funded',
            entityType: 'loan_offer',
            entityId: String(offer._id),
            after: {
              status: offer.status,
              amountPaise: offer.amountPaise,
              roiPercent: offer.roiPercent,
            },
          },
          session,
        );
        await writeAudit(
          ctx,
          {
            action: 'loan.created',
            entityType: 'loan',
            entityId: String(loan._id),
            after: {
              status: loan.status,
              amountPaise: loan.amountPaise,
              tenureMonths: loan.tenureMonths,
              roiPercent: loan.roiPercent,
            },
          },
          session,
        );
      });

      // Notify the borrower that their request was funded.
      notificationService.enqueue(
        String(createdLoan.borrowerId),
        'offer_funded',
        '🎉 Your loan request was funded',
        `${lenderSnapAndUser.snapshot.name} funded ₹${(createdLoan.amountPaise / 100).toLocaleString('en-IN')}. Open it to sign the agreement.`,
        { deepLink: `/loans/${createdLoan._id}`, metadata: { loanId: String(createdLoan._id) } },
      );

      return {
        offer: toPayload(createdOffer, String(createdLoan._id)),
        loan: loanToPayload(createdLoan),
      };
    } finally {
      await session.endSession();
    }
  },

  async getOne(offerId: string, viewerId: string): Promise<LoanOfferPayload> {
    if (!Types.ObjectId.isValid(offerId)) {
      throw new AppError('invalid_id', 'Offer id is not a valid ObjectId', 400);
    }
    const offer = await LoanOffer.findById(offerId);
    if (!offer) throw new AppError('offer_not_found', 'No offer with that id', 404);
    const allowed =
      String(offer.borrowerId) === viewerId || String(offer.lenderId) === viewerId;
    if (!allowed) throw new AppError('forbidden', 'You cannot view this offer.', 403);
    const loan = await Loan.findOne({ acceptedOfferId: offer._id });
    return toPayload(offer, loan ? String(loan._id) : undefined);
  },

  /** All offers on a single request — only the borrower can list. */
  async listForRequest(requestId: string, viewerId: string): Promise<LoanOfferPayload[]> {
    if (!Types.ObjectId.isValid(requestId)) {
      throw new AppError('invalid_id', 'Loan request id is not a valid ObjectId', 400);
    }
    const request = await LoanRequest.findById(requestId);
    if (!request) throw new AppError('loan_request_not_found', 'No loan request with that id', 404);
    if (String(request.borrowerId) !== viewerId) {
      throw new AppError('forbidden', 'Only the borrower can see the offer queue.', 403);
    }
    const offers = await LoanOffer.find({ loanRequestId: requestId }).sort({ sentAt: -1 });
    return offers.map((o) => toPayload(o));
  },

  /** "My offers" — flat list of offers the viewer is on either side of. */
  async listMine(
    userId: string,
    role: 'lender' | 'borrower' | 'either' = 'either',
  ): Promise<LoanOfferPayload[]> {
    const filter: Record<string, unknown> = {};
    if (role === 'lender') filter.lenderId = new Types.ObjectId(userId);
    else if (role === 'borrower') filter.borrowerId = new Types.ObjectId(userId);
    else
      filter.$or = [
        { lenderId: new Types.ObjectId(userId) },
        { borrowerId: new Types.ObjectId(userId) },
      ];

    const offers = await LoanOffer.find(filter).sort({ sentAt: -1 }).limit(50);
    // Attach loanId for accepted offers
    const acceptedIds = offers.filter((o) => o.status === 'accepted').map((o) => o._id);
    const loans = await Loan.find({ acceptedOfferId: { $in: acceptedIds } });
    const loanByOffer = new Map<string, string>();
    for (const l of loans) loanByOffer.set(String(l.acceptedOfferId), String(l._id));
    return offers.map((o) => toPayload(o, loanByOffer.get(String(o._id))));
  },
};

// Re-export for legacy callers
export type LenderDoc = UserDocument;
