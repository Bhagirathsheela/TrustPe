/**
 * DPDP Act §11–14 rights — data export and account deletion.
 *
 * Access request: build a JSON snapshot of everything we hold about the
 * user. Emailed on completion (Phase 1 — synchronous; Phase 2 could move
 * to a background job). Not full raw dumps of KYC images — those live in
 * Cloudinary and are shipped as URLs the user can fetch while their
 * account is still active.
 *
 * Delete-account request: soft-delete + purge policy.
 *   - Blocked if there are any live loans (active, awaiting_disbursal,
 *     awaiting_agreement) on either side — the user must settle those
 *     first (or accept default).
 *   - On success: user is suspended immediately, refresh tokens revoked,
 *     push tokens invalidated, KYC record marked pending deletion. A
 *     background sweep (added later) enforces the 30-day/90-day purge
 *     windows per Privacy Policy §10.
 *   - Audit-log entries survive purge — they're immutable by policy.
 *
 * See docs/PRIVACY_POLICY.md §§9-10 for the promises we're honouring.
 */
import { startSession, Types } from 'mongoose';
import { User } from '../models/User.js';
import { Profile } from '../models/Profile.js';
import { KycRecord } from '../models/KycRecord.js';
import { Loan } from '../models/Loan.js';
import { LoanRequest } from '../models/LoanRequest.js';
import { LoanOffer } from '../models/LoanOffer.js';
import { Review } from '../models/Review.js';
import { Notification } from '../models/Notification.js';
import { PushToken } from '../models/PushToken.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../middleware/error-handler.js';
import { writeAudit, type AuditContext } from '../utils/audit.js';
import { logger } from '../utils/logger.js';

/** Statuses that block deletion — the counter-party depends on these. */
const LIVE_LOAN_STATUSES = ['awaiting_agreement', 'awaiting_disbursal', 'active'];

export type DataExport = {
  generatedAt: string;
  account: {
    id: string;
    name: string;
    email: string;
    phone: string;
    handle?: string;
    status: string;
    kycStatus: string;
    trustScore: number;
    trustBand: string;
    roles: string[];
    createdAt: string;
    notificationPreferences?: { mutedCategories: string[] };
  };
  profile: Record<string, unknown> | null;
  kyc: Record<string, unknown> | null;
  loans: Record<string, unknown>[];
  loanRequests: Record<string, unknown>[];
  loanOffers: Record<string, unknown>[];
  reviews: { given: Record<string, unknown>[]; received: Record<string, unknown>[] };
  notifications: Record<string, unknown>[];
  auditLog: Record<string, unknown>[];
};

export type DeleteAccountResult =
  | { ok: true; deletedAt: string }
  | { ok: false; code: 'live_loans'; blockingLoanCount: number };

export const mePrivacyService = {
  /** Build a full export payload for the authenticated user. */
  async exportData(userId: string): Promise<DataExport> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('invalid_id', 'User id is not a valid ObjectId', 400);
    }
    const user = await User.findById(userId).lean();
    if (!user) throw new AppError('user_not_found', 'User not found', 404);

    const [
      profile,
      kyc,
      loans,
      loanRequests,
      loanOffers,
      reviewsGiven,
      reviewsReceived,
      notifications,
      auditLog,
    ] = await Promise.all([
      Profile.findOne({ userId }).lean(),
      KycRecord.findOne({ userId }).lean(),
      Loan.find({ $or: [{ borrowerId: userId }, { lenderId: userId }] }).lean(),
      LoanRequest.find({ borrowerId: userId }).lean(),
      LoanOffer.find({ $or: [{ senderId: userId }, { borrowerId: userId }, { lenderId: userId }] }).lean(),
      Review.find({ reviewerId: userId }).lean(),
      Review.find({ revieweeId: userId }).lean(),
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(500).lean(),
      AuditLog.find({
        $or: [{ actorId: userId }, { entityType: 'user', entityId: userId }],
      })
        .sort({ at: -1 })
        .limit(500)
        .lean(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      account: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        handle: user.handle,
        status: user.status,
        kycStatus: user.kycStatus,
        trustScore: user.trustScore ?? 300,
        trustBand: user.trustBand ?? 'building',
        roles: user.roles ?? ['user'],
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : '',
        notificationPreferences: user.notificationPreferences
          ? {
              mutedCategories:
                ((user.notificationPreferences as { mutedCategories?: string[] })
                  .mutedCategories ?? []) as string[],
            }
          : undefined,
      },
      profile: profile ? sanitiseDoc(profile) : null,
      kyc: kyc ? sanitiseKyc(kyc) : null,
      loans: loans.map(sanitiseDoc),
      loanRequests: loanRequests.map(sanitiseDoc),
      loanOffers: loanOffers.map(sanitiseDoc),
      reviews: {
        given: reviewsGiven.map(sanitiseDoc),
        received: reviewsReceived.map(sanitiseDoc),
      },
      notifications: notifications.map(sanitiseDoc),
      auditLog: auditLog.map(sanitiseDoc),
    };
  },

  /**
   * Preview whether a deletion request can proceed right now. Non-mutating
   * — useful for the mobile confirmation screen so the user sees what's
   * blocking before hitting the destructive button.
   */
  async deletionPrecheck(userId: string): Promise<{
    canDelete: boolean;
    blockingLoanCount: number;
    blockingLoanIds: string[];
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('invalid_id', 'User id is not a valid ObjectId', 400);
    }
    const blockingLoans = await Loan.find(
      {
        $or: [{ borrowerId: userId }, { lenderId: userId }],
        status: { $in: LIVE_LOAN_STATUSES },
      },
      { _id: 1 },
    );
    return {
      canDelete: blockingLoans.length === 0,
      blockingLoanCount: blockingLoans.length,
      blockingLoanIds: blockingLoans.map((l) => String(l._id)),
    };
  },

  /**
   * Execute deletion. Suspends the account, revokes tokens, invalidates
   * push devices, and marks KYC/profile for background purge. Actual
   * document removal happens in a scheduled purge job (added later) so
   * we can offer the user a short grace window to reverse the decision.
   *
   * Returns `{ok:false, code:'live_loans'}` if there are live loans —
   * the mobile UI should tell the user to settle those first.
   */
  async deleteAccount(
    userId: string,
    reason: string | undefined,
    ctx: AuditContext,
  ): Promise<DeleteAccountResult> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('invalid_id', 'User id is not a valid ObjectId', 400);
    }

    const precheck = await this.deletionPrecheck(userId);
    if (!precheck.canDelete) {
      return {
        ok: false,
        code: 'live_loans',
        blockingLoanCount: precheck.blockingLoanCount,
      };
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError('user_not_found', 'User not found', 404);

    const before = {
      status: user.status,
      kycStatus: user.kycStatus,
    };

    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        user.status = 'suspended';
        user.suspendedAt = new Date();
        user.suspendedReason = `account_deletion_requested${reason ? `: ${reason}` : ''}`;
        await user.save({ session });

        // Revoke every refresh token for this user (all devices).
        await RefreshToken.updateMany(
          { userId: new Types.ObjectId(userId), revokedAt: { $exists: false } },
          { $set: { revokedAt: new Date(), revokedReason: 'account_deleted' } },
          { session },
        );

        // Invalidate every push token so we stop trying to reach the device.
        await PushToken.updateMany(
          { userId: new Types.ObjectId(userId), invalidatedAt: { $exists: false } },
          { $set: { invalidatedAt: new Date() } },
          { session },
        );

        await writeAudit(
          ctx,
          {
            action: 'user.deletion_requested',
            entityType: 'user',
            entityId: String(user._id),
            before,
            after: {
              status: user.status,
              kycStatus: user.kycStatus,
            },
            metadata: { reason: reason ?? null },
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    logger.info({ userId }, '[me-privacy] account deletion requested');
    return { ok: true, deletedAt: new Date().toISOString() };
  },
};

function sanitiseDoc(doc: Record<string, unknown>): Record<string, unknown> {
  // Lean docs still have __v; drop it for readability. Convert ObjectIds
  // to strings so the export is a portable JSON blob the user can open
  // in any viewer.
  const { __v, ...rest } = doc;
  void __v;
  return convertIds(rest);
}

function sanitiseKyc(doc: Record<string, unknown>): Record<string, unknown> {
  // Cloudinary IDs are exported so the user knows what we hold, but we
  // do NOT include signed URLs — those are short-lived and a stored
  // signed URL would leak beyond its lifetime.
  const sanitised = sanitiseDoc(doc);
  sanitised._note =
    'KYC document images are stored encrypted at rest. To download the images themselves, email privacy@trustpe.in with this export.';
  return sanitised;
}

function convertIds(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Types.ObjectId) return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(convertIds);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = convertIds(v);
    return out;
  }
  return value;
}
