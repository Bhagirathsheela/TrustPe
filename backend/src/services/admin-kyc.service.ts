/**
 * Admin KYC service — review queue + decision handling.
 *
 * Closes the loop opened by `kyc.service.ts`:
 *   - List KYC records pending review (queue).
 *   - Fetch a single record with the linked user.
 *   - Apply an approve / reject / request_clarification decision, which
 *     transitions both the KycRecord.status and the linked User.status +
 *     User.kycStatus atomically and emits the appropriate audit entries.
 *
 * State map applied here:
 *   approve              → kyc=approved,             user.status=active,         user.kycStatus=approved
 *                          + trustScore 300 → 550 (Building → Fair), per User.ts
 *   reject               → kyc=rejected,             user.status=suspended,      user.kycStatus=rejected
 *   request_clarification → kyc=needs_clarification, user.status=onboarding,     user.kycStatus=needs_clarification
 *
 * `request_clarification` puts the user back in `onboarding` so the existing
 * resubmission path in kyc.service.ts (which requires status === 'onboarding')
 * lets them retry without an admin tool intervention.
 *
 * See ARCHITECTURE.md §6.3 (controller/service split) and CLAUDE.md
 * "Audit logging — never bypass".
 */
import { startSession, Types } from 'mongoose';
import { KycRecord, type KycRecordDocument } from '../models/KycRecord.js';
import { User, type UserDocument } from '../models/User.js';
import { Profile } from '../models/Profile.js';
import { AppError } from '../middleware/error-handler.js';
import { writeAudit, type AuditContext } from '../utils/audit.js';
import { emailService } from './email.service.js';
import { notificationService } from './notification.service.js';
import type { KycDecisionInput, KycQueueQuery } from 'trustpe-shared';

// TrustScore bump on KYC approval — see User.ts comment.
// New users start at 300 (Building), KYC approval moves them to 550 (Fair).
const KYC_APPROVAL_TRUST_SCORE = 550;
const KYC_APPROVAL_TRUST_BAND = 'fair' as const;

export type AdminKycListItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  pan: string;
  status: string;
  submittedAt: string;
  reviewedAt?: string;
};

export type AdminKycDetail = AdminKycListItem & {
  aadhaarFrontCloudinaryId: string;
  aadhaarBackCloudinaryId: string;
  panFrontCloudinaryId: string;
  selfieVideoCloudinaryId: string;
  vpa: string;
  vpaVerificationMethod: string;
  reviewerNotes?: string;
  reviewedBy?: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    kycStatus: string;
    trustScore: number;
    trustBand: string;
    createdAt?: string;
  };
};

type RecordWithUser = KycRecordDocument & { userId: UserDocument | Types.ObjectId };

function isPopulatedUser(u: KycRecordDocument['userId'] | UserDocument): u is UserDocument {
  return Boolean(u) && typeof u === 'object' && 'email' in (u as object);
}

function toListItem(record: RecordWithUser): AdminKycListItem {
  const user = isPopulatedUser(record.userId)
    ? record.userId
    : null;
  return {
    id: String(record._id),
    userId: user ? String(user._id) : String(record.userId),
    userName: user?.name ?? '',
    userEmail: user?.email ?? '',
    userPhone: user?.phone ?? '',
    pan: record.pan,
    status: record.status,
    submittedAt: record.submittedAt.toISOString(),
    reviewedAt: record.reviewedAt?.toISOString(),
  };
}

function toDetail(record: RecordWithUser): AdminKycDetail {
  if (!isPopulatedUser(record.userId)) {
    throw new AppError('user_not_populated', 'KYC record user was not populated', 500);
  }
  const user = record.userId;
  const userWithTs = user as UserDocument & { createdAt?: Date };
  return {
    ...toListItem(record),
    aadhaarFrontCloudinaryId: record.aadhaarFrontCloudinaryId,
    aadhaarBackCloudinaryId: record.aadhaarBackCloudinaryId,
    panFrontCloudinaryId: record.panFrontCloudinaryId,
    selfieVideoCloudinaryId: record.selfieVideoCloudinaryId,
    vpa: record.vpa,
    vpaVerificationMethod: record.vpaVerificationMethod,
    reviewerNotes: record.reviewerNotes ?? undefined,
    reviewedBy: record.reviewedBy ? String(record.reviewedBy) : undefined,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      kycStatus: user.kycStatus,
      trustScore: user.trustScore ?? 300,
      trustBand: user.trustBand ?? 'building',
      createdAt: userWithTs.createdAt?.toISOString(),
    },
  };
}

export const adminKycService = {
  /**
   * Paginated KYC queue. Default returns submitted records ordered by submission
   * time (oldest first → reviewers handle the longest-waiting first).
   */
  async listQueue(query: KycQueueQuery): Promise<{
    items: AdminKycListItem[];
    nextCursor: string | null;
  }> {
    const filter: Record<string, unknown> = { status: query.status };
    if (query.cursor) {
      if (!/^[0-9a-fA-F]{24}$/.test(query.cursor)) {
        throw new AppError('invalid_cursor', 'Cursor is not a valid id', 400);
      }
      filter._id = { $gt: new Types.ObjectId(query.cursor) };
    }

    const records = await KycRecord.find(filter)
      .sort({ _id: 1 })
      .limit(query.limit + 1)
      .populate<{ userId: UserDocument }>('userId', 'name email phone status kycStatus trustScore trustBand')
      .lean<RecordWithUser[]>({ getters: false, virtuals: false });

    const hasMore = records.length > query.limit;
    const pageItems = hasMore ? records.slice(0, query.limit) : records;
    const nextCursor = hasMore && pageItems.length > 0
      ? String(pageItems[pageItems.length - 1]!._id)
      : null;

    return {
      items: pageItems.map(toListItem),
      nextCursor,
    };
  },

  /** Fetch one KYC record with the linked user. */
  async getOne(kycId: string): Promise<AdminKycDetail> {
    if (!Types.ObjectId.isValid(kycId)) {
      throw new AppError('invalid_id', 'KYC id is not a valid ObjectId', 400);
    }
    const record = await KycRecord.findById(kycId).populate<{ userId: UserDocument }>(
      'userId',
      'name email phone status kycStatus trustScore trustBand createdAt',
    );
    if (!record) {
      throw new AppError('kyc_not_found', 'No KYC record with that id', 404);
    }
    return toDetail(record as unknown as RecordWithUser);
  },

  /**
   * Apply an admin decision. Atomically transitions KycRecord + User and
   * writes audit entries for both. Idempotency-of-intent: only records in
   * `submitted` may be transitioned (re-decisions require a re-submission).
   */
  async decide(
    kycId: string,
    adminId: string,
    input: KycDecisionInput,
    ctx: AuditContext,
  ): Promise<AdminKycDetail> {
    if (!Types.ObjectId.isValid(kycId)) {
      throw new AppError('invalid_id', 'KYC id is not a valid ObjectId', 400);
    }
    if (!Types.ObjectId.isValid(adminId)) {
      throw new AppError('invalid_admin_id', 'Admin id is not a valid ObjectId', 400);
    }

    const record = await KycRecord.findById(kycId);
    if (!record) throw new AppError('kyc_not_found', 'No KYC record with that id', 404);

    if (record.status !== 'submitted') {
      throw new AppError(
        'kyc_not_pending',
        `KYC record is in "${record.status}", not "submitted". A new submission is required before a fresh decision.`,
        409,
      );
    }

    const user = await User.findById(record.userId);
    if (!user) throw new AppError('user_not_found', 'Linked user no longer exists', 404);

    // Compute next state per decision.
    let nextKycStatus: KycRecordDocument['status'];
    let nextUserStatus: UserDocument['status'];
    let nextUserKycStatus: UserDocument['kycStatus'];
    switch (input.decision) {
      case 'approve':
        nextKycStatus = 'approved';
        nextUserStatus = 'active';
        nextUserKycStatus = 'approved';
        break;
      case 'reject':
        nextKycStatus = 'rejected';
        nextUserStatus = 'suspended';
        nextUserKycStatus = 'rejected';
        break;
      case 'request_clarification':
        nextKycStatus = 'needs_clarification';
        nextUserStatus = 'onboarding';
        nextUserKycStatus = 'needs_clarification';
        break;
    }

    const kycBefore = { status: record.status, reviewerNotes: record.reviewerNotes ?? null };
    const userBefore = {
      status: user.status,
      kycStatus: user.kycStatus,
      trustScore: user.trustScore,
      trustBand: user.trustBand,
    };

    const session = await startSession();
    try {
      await session.withTransaction(async () => {
        record.status = nextKycStatus;
        record.reviewedAt = new Date();
        record.reviewedBy = new Types.ObjectId(adminId);
        record.reviewerNotes = input.reason;
        await record.save({ session });

        user.status = nextUserStatus;
        user.kycStatus = nextUserKycStatus;

        // Approval triggers the documented one-shot TrustScore jump (300 → 550).
        // We only apply the bump on first-ever approval — a re-approval after
        // clarification leaves the score where it is.
        const currentScore = user.trustScore ?? 300;
        if (input.decision === 'approve' && currentScore < KYC_APPROVAL_TRUST_SCORE) {
          user.trustScore = KYC_APPROVAL_TRUST_SCORE;
          user.trustBand = KYC_APPROVAL_TRUST_BAND;
        }

        if (input.decision === 'reject') {
          user.suspendedAt = new Date();
          user.suspendedReason = input.reason ?? 'KYC rejected';
        }

        await user.save({ session });

        // If approval, ensure a Profile stub exists so the rest of the app can
        // safely assume one is present (profile is created lazily in
        // profile.service.ts otherwise, but creating it here unblocks reads
        // immediately after approval).
        if (input.decision === 'approve') {
          await Profile.updateOne(
            { userId: user._id },
            { $setOnInsert: { userId: user._id, name: user.name } },
            { upsert: true, session },
          );
        }

        await writeAudit(
          ctx,
          {
            action: `kyc.${input.decision}`,
            entityType: 'kyc',
            entityId: String(record._id),
            before: kycBefore,
            after: { status: record.status, reviewerNotes: record.reviewerNotes ?? null },
            metadata: { adminId, reason: input.reason ?? null },
          },
          session,
        );
        await writeAudit(
          ctx,
          {
            action: 'user.status.changed',
            entityType: 'user',
            entityId: String(user._id),
            before: userBefore,
            after: {
              status: user.status,
              kycStatus: user.kycStatus,
              trustScore: user.trustScore,
              trustBand: user.trustBand,
            },
            metadata: { trigger: `kyc.${input.decision}`, adminId },
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    // Side effects after the transaction commits — best-effort, never throws.
    // In-app + push notification...
    const kindByDecision = {
      approve: 'kyc_approved',
      reject: 'kyc_rejected',
      request_clarification: 'kyc_clarification',
    } as const;
    const titleByDecision = {
      approve: '✅ Your KYC was approved',
      reject: '❌ Your KYC was rejected',
      request_clarification: '📝 KYC needs more info',
    } as const;
    const bodyByDecision = {
      approve: 'You can now request and fund loans. TrustScore bumped to 550.',
      reject: input.reason ?? 'Please contact the TrustPe team.',
      request_clarification: input.reason ?? 'Open the app to re-submit.',
    } as const;
    notificationService.enqueue(
      String(user._id),
      kindByDecision[input.decision],
      titleByDecision[input.decision],
      bodyByDecision[input.decision],
      { deepLink: '/home', metadata: { kycId: String(record._id) } },
    );
    // ...and the email (fire-and-forget; failures don't bubble up).
    void emailService.sendKycDecision(
      user.email,
      user.name,
      input.decision,
      input.reason,
    );

    // Re-populate to keep the return shape consistent with getOne.
    const populated = await KycRecord.findById(kycId).populate<{ userId: UserDocument }>(
      'userId',
      'name email phone status kycStatus trustScore trustBand createdAt',
    );
    if (!populated) {
      throw new AppError('kyc_not_found', 'KYC vanished after decision', 500);
    }
    return toDetail(populated as unknown as RecordWithUser);
  },
};
