/**
 * KYC service — submit + read KYC records.
 *
 * On submission:
 *   - Validates that the user is in 'onboarding' state (not already submitted)
 *   - Creates the KycRecord with status 'submitted'
 *   - Moves user.status to 'pending_review' and user.kycStatus to 'submitted'
 *   - Writes audit log entries for both the KYC create and the user state change
 *
 * Admin review endpoints land in the next round.
 */
import { startSession } from 'mongoose';
import { KycRecord, type KycRecordDocument } from '../models/KycRecord.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/error-handler.js';
import { writeAudit, type AuditContext } from '../utils/audit.js';
import type { KycSubmissionInput } from 'trustpe-shared';

export type KycPayload = {
  id: string;
  userId: string;
  pan: string;
  aadhaarFrontCloudinaryId: string;
  aadhaarBackCloudinaryId: string;
  panFrontCloudinaryId: string;
  selfieVideoCloudinaryId: string;
  vpa: string;
  vpaVerificationMethod: string;
  status: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewerNotes?: string;
};

function toPayload(r: KycRecordDocument): KycPayload {
  return {
    id: String(r._id),
    userId: String(r.userId),
    pan: r.pan,
    aadhaarFrontCloudinaryId: r.aadhaarFrontCloudinaryId,
    aadhaarBackCloudinaryId: r.aadhaarBackCloudinaryId,
    panFrontCloudinaryId: r.panFrontCloudinaryId,
    selfieVideoCloudinaryId: r.selfieVideoCloudinaryId,
    vpa: r.vpa,
    vpaVerificationMethod: r.vpaVerificationMethod,
    status: r.status,
    submittedAt: r.submittedAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString(),
    reviewerNotes: r.reviewerNotes ?? undefined,
  };
}

export const kycService = {
  async getMyKyc(userId: string): Promise<KycPayload | null> {
    const record = await KycRecord.findOne({ userId });
    return record ? toPayload(record) : null;
  },

  async submit(
    userId: string,
    input: KycSubmissionInput,
    ctx: AuditContext,
  ): Promise<KycPayload> {
    const user = await User.findById(userId);
    if (!user) throw new AppError('user_not_found', 'User no longer exists', 404);

    if (user.status === 'pending_review') {
      throw new AppError(
        'kyc_already_submitted',
        'Your KYC is already under review. Wait for the team to respond.',
        409,
      );
    }
    if (user.status !== 'onboarding') {
      throw new AppError(
        'kyc_wrong_state',
        `Cannot submit KYC while account status is "${user.status}".`,
        400,
      );
    }

    // Duplicate-PAN guard. A PAN is uniquely tied to one person under the
    // Income Tax Act — two TrustPe accounts claiming the same PAN is either
    // a typo or an impersonation attempt. We block the submission unless the
    // existing record on that PAN belongs to the same user (resubmission).
    // Rejected records still block: if a different user couldn't get
    // approved with that PAN, a new user shouldn't be able to claim it.
    const panClash = await KycRecord.findOne({
      pan: input.pan,
      userId: { $ne: user._id },
    });
    if (panClash) {
      throw new AppError(
        'pan_already_in_use',
        'This PAN is already linked to another TrustPe account. If this is yours, contact support to recover the original account.',
        409,
      );
    }

    const existing = await KycRecord.findOne({ userId });

    const session = await startSession();
    try {
      let record!: KycRecordDocument;

      await session.withTransaction(async () => {
        if (existing) {
          // Re-submission after a "needs_clarification" — update existing record
          existing.set({
            pan: input.pan,
            aadhaarFrontCloudinaryId: input.aadhaarFrontCloudinaryId,
            aadhaarBackCloudinaryId: input.aadhaarBackCloudinaryId,
            panFrontCloudinaryId: input.panFrontCloudinaryId,
            selfieVideoCloudinaryId: input.selfieVideoCloudinaryId,
            vpa: input.vpa,
            vpaVerificationMethod: 'admin_manual',
            status: 'submitted',
            submittedAt: new Date(),
            reviewedAt: undefined,
            reviewerNotes: undefined,
          });
          record = await existing.save({ session });
        } else {
          const [created] = await KycRecord.create(
            [
              {
                userId,
                pan: input.pan,
                aadhaarFrontCloudinaryId: input.aadhaarFrontCloudinaryId,
                aadhaarBackCloudinaryId: input.aadhaarBackCloudinaryId,
                panFrontCloudinaryId: input.panFrontCloudinaryId,
                selfieVideoCloudinaryId: input.selfieVideoCloudinaryId,
                vpa: input.vpa,
                vpaVerificationMethod: 'admin_manual',
                status: 'submitted',
                submittedAt: new Date(),
              },
            ],
            { session },
          );
          record = created!;
        }

        const userBefore = { status: user.status, kycStatus: user.kycStatus };
        user.status = 'pending_review';
        user.kycStatus = 'submitted';
        await user.save({ session });

        await writeAudit(
          ctx,
          {
            action: existing ? 'kyc.resubmitted' : 'kyc.submitted',
            entityType: 'kyc',
            entityId: String(record._id),
            after: { status: record.status, pan: record.pan },
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
            after: { status: user.status, kycStatus: user.kycStatus },
            metadata: { trigger: 'kyc.submit' },
          },
          session,
        );
      });

      return toPayload(record);
    } finally {
      await session.endSession();
    }
  },
};
