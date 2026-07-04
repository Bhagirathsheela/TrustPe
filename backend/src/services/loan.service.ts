/**
 * Loan service — Sprint 2B read-only surface.
 *
 * Loans are created by the offer-acceptance flow (loan-offer.service.ts).
 * This service just lists and fetches them. Disbursal, EMI, repayment, and
 * closure transitions land in Sprint 3.
 */
import { Types } from 'mongoose';
import { type MyLoansQuery } from 'trustpe-shared';
import { Loan, type LoanDocument } from '../models/Loan.js';
import { AppError } from '../middleware/error-handler.js';

export type LoanPayload = ReturnType<typeof toPayload>;

function toPayload(l: LoanDocument) {
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

export const loanService = {
  async getMine(userId: string, query: MyLoansQuery): Promise<LoanPayload[]> {
    const oid = new Types.ObjectId(userId);
    const baseFilter: Record<string, unknown> =
      query.role === 'borrower'
        ? { borrowerId: oid }
        : query.role === 'lender'
          ? { lenderId: oid }
          : { $or: [{ borrowerId: oid }, { lenderId: oid }] };

    if (query.status) baseFilter.status = query.status;

    const loans = await Loan.find(baseFilter).sort({ agreedAt: -1 }).limit(query.limit);
    return loans.map(toPayload);
  },

  async getOne(loanId: string, viewerId: string): Promise<LoanPayload> {
    if (!Types.ObjectId.isValid(loanId)) {
      throw new AppError('invalid_id', 'Loan id is not a valid ObjectId', 400);
    }
    const loan = await Loan.findById(loanId);
    if (!loan) throw new AppError('loan_not_found', 'No loan with that id', 404);
    const allowed = String(loan.borrowerId) === viewerId || String(loan.lenderId) === viewerId;
    if (!allowed) throw new AppError('forbidden', 'You cannot view this loan.', 403);
    return toPayload(loan);
  },
};
