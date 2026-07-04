/**
 * Loan-request service — create, read, update, cancel + lender search.
 *
 * Fixed-rate model: borrower commits to a single `roiPercent` at creation.
 * Lenders fund at exactly that rate (no negotiation). State ROI cap is
 * enforced against the borrower's resolved state from their profile city.
 *
 * Concurrency rules:
 *   - One open request per borrower at a time
 *   - Cancellation only while status='open'
 *   - Update only while status='open' (and no funds — implicit since funding
 *     transitions to matched)
 */
import { Types } from 'mongoose';
import {
  type CreateLoanRequestInput,
  type LoanRequestQuery,
  type UpdateLoanRequestInput,
  getStateRoiCap,
} from 'trustpe-shared';
import { LoanRequest, type LoanRequestDocument } from '../models/LoanRequest.js';
import { Profile } from '../models/Profile.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/error-handler.js';
import { writeAudit, type AuditContext } from '../utils/audit.js';
import { eligibilityService } from './eligibility.service.js';

/** Default expiry window — request goes stale after 30 days. */
const REQUEST_TTL_DAYS = 30;

export type LoanRequestPayload = {
  id: string;
  borrowerId: string;
  amountPaise: number;
  tenureMonths: number;
  roiPercent: number;
  purpose: string;
  purposeDetail?: string;
  status: string;
  snapshot: {
    borrowerName: string;
    borrowerCity?: string;
    borrowerState?: string;
    borrowerStateRoiCap: number;
    borrowerTrustScore: number;
    borrowerTrustBand: string;
  };
  offersCount: number;
  publishedAt: string;
  expiresAt: string;
  matchedAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
};

function toPayload(r: LoanRequestDocument): LoanRequestPayload {
  const cap = getStateRoiCap(r.snapshot.borrowerCity);
  return {
    id: String(r._id),
    borrowerId: String(r.borrowerId),
    amountPaise: r.amountPaise,
    tenureMonths: r.tenureMonths,
    roiPercent: r.roiPercent,
    purpose: r.purpose,
    purposeDetail: r.purposeDetail ?? undefined,
    status: r.status,
    snapshot: {
      borrowerName: r.snapshot.borrowerName,
      borrowerCity: r.snapshot.borrowerCity ?? undefined,
      borrowerState: cap.state ?? undefined,
      borrowerStateRoiCap: cap.cap,
      borrowerTrustScore: r.snapshot.borrowerTrustScore,
      borrowerTrustBand: r.snapshot.borrowerTrustBand,
    },
    offersCount: r.offersCount ?? 0,
    publishedAt: r.publishedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    matchedAt: r.matchedAt?.toISOString(),
    cancelledAt: r.cancelledAt?.toISOString(),
    cancelledReason: r.cancelledReason ?? undefined,
  };
}

export const loanRequestService = {
  /**
   * Create a new loan request. Enforces eligibility ladder + state ROI cap
   * + single-open-per-borrower.
   */
  async create(
    borrowerId: string,
    input: CreateLoanRequestInput,
    ctx: AuditContext,
  ): Promise<LoanRequestPayload> {
    const borrower = await User.findById(borrowerId);
    if (!borrower) throw new AppError('user_not_found', 'User no longer exists', 404);

    const elig = eligibilityService.forBorrow(borrower);
    if (!elig.ok) {
      throw new AppError(elig.reasonCode ?? 'not_eligible', elig.reason ?? 'Not eligible', 400);
    }
    if (input.amountPaise > elig.maxBorrowPaise) {
      throw new AppError(
        'amount_exceeds_tier_cap',
        `Your current tier (${elig.tier}) caps requests at ₹${elig.maxBorrowPaise / 100}. Reduce the amount or build your TrustScore.`,
        400,
      );
    }

    // State ROI cap. Resolve from borrower's profile city.
    const profile = await Profile.findOne({ userId: borrowerId });
    const stateCap = getStateRoiCap(profile?.city);
    if (input.roiPercent > stateCap.cap) {
      throw new AppError(
        'roi_above_state_cap',
        stateCap.hasExplicitCap
          ? `${stateCap.state} caps moneylender interest at ${stateCap.cap}% p.a. Reduce the rate.`
          : `The default ceiling for this borrower's state is ${stateCap.cap}% p.a.`,
        400,
      );
    }

    // One active request per borrower at a time.
    const existing = await LoanRequest.findOne({ borrowerId, status: 'open' });
    if (existing) {
      throw new AppError(
        'open_request_exists',
        'You already have an active loan request. Cancel it first or wait for it to close.',
        409,
      );
    }

    const expiresAt = new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);

    let created: LoanRequestDocument | undefined;
    try {
      [created] = await LoanRequest.create([
        {
          borrowerId,
          amountPaise: input.amountPaise,
          tenureMonths: input.tenureMonths,
          roiPercent: input.roiPercent,
          purpose: input.purpose,
          purposeDetail: input.purposeDetail,
          status: 'open',
          snapshot: {
            borrowerName: borrower.name,
            borrowerCity: profile?.city ?? undefined,
            borrowerTrustScore: borrower.trustScore ?? 300,
            borrowerTrustBand: borrower.trustBand ?? 'building',
          },
          publishedAt: new Date(),
          expiresAt,
        },
      ]);
    } catch (err) {
      // Lost the one-open-per-borrower race — same friendly 409 as the
      // pre-check above (backed by uniq_open_request_per_borrower index).
      if ((err as { code?: number }).code === 11000) {
        throw new AppError(
          'open_request_exists',
          'You already have an active loan request. Cancel it first or wait for it to close.',
          409,
        );
      }
      throw err;
    }
    if (!created) throw new AppError('create_failed', 'Failed to create loan request', 500);

    await writeAudit(ctx, {
      action: 'loan_request.created',
      entityType: 'loan_request',
      entityId: String(created._id),
      after: {
        status: created.status,
        amountPaise: created.amountPaise,
        tenureMonths: created.tenureMonths,
        roiPercent: created.roiPercent,
        purpose: created.purpose,
      },
    });

    return toPayload(created);
  },

  async getOne(id: string): Promise<LoanRequestPayload> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('invalid_id', 'Loan request id is not a valid ObjectId', 400);
    }
    const record = await LoanRequest.findById(id);
    if (!record) throw new AppError('loan_request_not_found', 'No loan request with that id', 404);
    return toPayload(record);
  },

  async getMine(borrowerId: string, limit = 20): Promise<LoanRequestPayload[]> {
    const records = await LoanRequest.find({ borrowerId })
      .sort({ publishedAt: -1 })
      .limit(limit);
    return records.map(toPayload);
  },

  async update(
    id: string,
    borrowerId: string,
    input: UpdateLoanRequestInput,
    ctx: AuditContext,
  ): Promise<LoanRequestPayload> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('invalid_id', 'Loan request id is not a valid ObjectId', 400);
    }
    const record = await LoanRequest.findById(id);
    if (!record) throw new AppError('loan_request_not_found', 'No loan request with that id', 404);
    if (String(record.borrowerId) !== borrowerId) {
      throw new AppError('not_owner', 'You can only edit your own loan requests', 403);
    }
    if (record.status !== 'open') {
      throw new AppError(
        'not_editable',
        `Cannot edit a loan request in "${record.status}" state.`,
        409,
      );
    }

    // Re-check eligibility if the amount went up.
    if (input.amountPaise !== undefined && input.amountPaise > record.amountPaise) {
      const borrower = await User.findById(borrowerId);
      if (!borrower) throw new AppError('user_not_found', 'User no longer exists', 404);
      const elig = eligibilityService.forBorrow(borrower);
      if (!elig.ok || input.amountPaise > elig.maxBorrowPaise) {
        throw new AppError(
          'amount_exceeds_tier_cap',
          `Your current tier (${elig.tier}) caps requests at ₹${elig.maxBorrowPaise / 100}.`,
          400,
        );
      }
    }

    // Re-check state ROI cap if rate went up.
    if (input.roiPercent !== undefined && input.roiPercent > record.roiPercent) {
      const stateCap = getStateRoiCap(record.snapshot.borrowerCity);
      if (input.roiPercent > stateCap.cap) {
        throw new AppError(
          'roi_above_state_cap',
          stateCap.hasExplicitCap
            ? `${stateCap.state} caps moneylender interest at ${stateCap.cap}% p.a.`
            : `Cap is ${stateCap.cap}% p.a.`,
          400,
        );
      }
    }

    const before = {
      amountPaise: record.amountPaise,
      tenureMonths: record.tenureMonths,
      roiPercent: record.roiPercent,
      purpose: record.purpose,
      purposeDetail: record.purposeDetail,
    };

    if (input.amountPaise !== undefined) record.amountPaise = input.amountPaise;
    if (input.tenureMonths !== undefined) record.tenureMonths = input.tenureMonths;
    if (input.roiPercent !== undefined) record.roiPercent = input.roiPercent;
    if (input.purpose !== undefined) record.purpose = input.purpose;
    if (input.purposeDetail !== undefined) record.purposeDetail = input.purposeDetail;
    await record.save();

    await writeAudit(ctx, {
      action: 'loan_request.updated',
      entityType: 'loan_request',
      entityId: String(record._id),
      before,
      after: {
        amountPaise: record.amountPaise,
        tenureMonths: record.tenureMonths,
        roiPercent: record.roiPercent,
        purpose: record.purpose,
        purposeDetail: record.purposeDetail,
      },
    });

    return toPayload(record);
  },

  async cancel(
    id: string,
    borrowerId: string,
    reason: string | undefined,
    ctx: AuditContext,
  ): Promise<LoanRequestPayload> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('invalid_id', 'Loan request id is not a valid ObjectId', 400);
    }
    const record = await LoanRequest.findById(id);
    if (!record) throw new AppError('loan_request_not_found', 'No loan request with that id', 404);
    if (String(record.borrowerId) !== borrowerId) {
      throw new AppError('not_owner', 'You can only cancel your own loan requests', 403);
    }
    if (record.status === 'matched') {
      throw new AppError(
        'already_matched',
        'This request was already funded and cannot be cancelled.',
        409,
      );
    }
    if (record.status === 'cancelled' || record.status === 'expired') {
      return toPayload(record); // idempotent
    }

    const before = { status: record.status };
    record.status = 'cancelled';
    record.cancelledAt = new Date();
    record.cancelledReason = reason;
    await record.save();

    await writeAudit(ctx, {
      action: 'loan_request.cancelled',
      entityType: 'loan_request',
      entityId: String(record._id),
      before,
      after: { status: record.status, cancelledReason: record.cancelledReason ?? null },
    });

    return toPayload(record);
  },

  /**
   * Lender browse with filters + cursor pagination.
   *
   * Excludes the caller's own requests.
   */
  async search(
    callerId: string,
    query: LoanRequestQuery,
  ): Promise<{ items: LoanRequestPayload[]; nextCursor: string | null }> {
    const filter: Record<string, unknown> = {
      status: 'open',
      // Expired-but-not-yet-swept requests must not be browsable/fundable.
      expiresAt: { $gt: new Date() },
      borrowerId: { $ne: new Types.ObjectId(callerId) },
    };
    if (query.purpose) filter.purpose = query.purpose;
    if (query.minAmountPaise || query.maxAmountPaise) {
      const amountFilter: Record<string, number> = {};
      if (query.minAmountPaise !== undefined) amountFilter.$gte = query.minAmountPaise;
      if (query.maxAmountPaise !== undefined) amountFilter.$lte = query.maxAmountPaise;
      filter.amountPaise = amountFilter;
    }
    if (query.minTenure || query.maxTenure) {
      const tenureFilter: Record<string, number> = {};
      if (query.minTenure !== undefined) tenureFilter.$gte = query.minTenure;
      if (query.maxTenure !== undefined) tenureFilter.$lte = query.maxTenure;
      filter.tenureMonths = tenureFilter;
    }
    if (query.city) {
      filter['snapshot.borrowerCity'] = new RegExp(`^${escapeRegex(query.city)}`, 'i');
    }
    if (query.minTrustScore !== undefined) {
      filter['snapshot.borrowerTrustScore'] = { $gte: query.minTrustScore };
    }
    const isAmountSort = query.sort === 'amount_asc' || query.sort === 'amount_desc';
    if (query.cursor) {
      // Amount sorts use a compound cursor "<amountPaise>_<id>" — a bare _id
      // cursor doesn't align with the sort order and skips/duplicates rows.
      // Plain-id cursors (older clients / date sorts) keep working unchanged.
      const [rawSecondary, rawId] = query.cursor.includes('_')
        ? (query.cursor.split('_') as [string, string])
        : [null, query.cursor];
      if (!rawId || !/^[0-9a-fA-F]{24}$/.test(rawId)) {
        throw new AppError('invalid_cursor', 'Cursor is not a valid id', 400);
      }
      const cursorId = new Types.ObjectId(rawId);
      const dir = sortDirection(query.sort);
      const amt = rawSecondary !== null ? Number(rawSecondary) : NaN;
      if (isAmountSort && Number.isFinite(amt)) {
        filter.$or = [
          { amountPaise: dir === 1 ? { $gt: amt } : { $lt: amt } },
          { amountPaise: amt, _id: dir === 1 ? { $gt: cursorId } : { $lt: cursorId } },
        ];
      } else {
        filter._id = dir === 1 ? { $gt: cursorId } : { $lt: cursorId };
      }
    }

    const sort = buildSort(query.sort);

    const records = await LoanRequest.find(filter)
      .sort(sort)
      .limit(query.limit + 1);

    const hasMore = records.length > query.limit;
    const pageItems = hasMore ? records.slice(0, query.limit) : records;
    const last = pageItems[pageItems.length - 1];
    const nextCursor =
      !hasMore || !last
        ? null
        : isAmountSort
          ? `${last.amountPaise}_${String(last._id)}`
          : String(last._id);

    return { items: pageItems.map(toPayload), nextCursor };
  },
};

// ---- helpers --------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSort(sortKey: LoanRequestQuery['sort']): Record<string, 1 | -1> {
  switch (sortKey) {
    case 'oldest':
      return { publishedAt: 1, _id: 1 };
    case 'amount_asc':
      return { amountPaise: 1, _id: 1 };
    case 'amount_desc':
      return { amountPaise: -1, _id: -1 };
    case 'newest':
    default:
      return { publishedAt: -1, _id: -1 };
  }
}

function sortDirection(sortKey: LoanRequestQuery['sort']): 1 | -1 {
  return sortKey === 'oldest' || sortKey === 'amount_asc' ? 1 : -1;
}
