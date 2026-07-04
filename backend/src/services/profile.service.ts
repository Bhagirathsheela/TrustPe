/**
 * Profile service — fetch + upsert a user's profile.
 *
 * Profile completeness rule: city + occupationCategory + declaredMonthlyIncome
 * are the minimum required fields for the user to proceed to KYC. The
 * `isComplete` flag in the returned shape reflects this.
 *
 * Every write produces an audit log entry per CLAUDE.md "Audit logging".
 */
import { Profile, type ProfileDocument } from '../models/Profile.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/error-handler.js';
import { writeAudit, type AuditContext } from '../utils/audit.js';
import type { UpdateProfileInput } from 'trustpe-shared';

type ProfilePayload = {
  userId: string;
  name: string;
  photoUrl?: string;
  city?: string;
  bio?: string;
  occupationCategory?: string;
  occupationDetail?: string;
  declaredMonthlyIncome?: string;
  monthlyLendingCapacityPaise?: number;
  isComplete: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function toPayload(profile: ProfileDocument): ProfilePayload {
  const isComplete = Boolean(
    profile.city && profile.occupationCategory && profile.declaredMonthlyIncome,
  );
  return {
    userId: String(profile.userId),
    name: profile.name,
    photoUrl: undefined, // resolved via Cloudinary URL helper in Sprint 1 KYC round
    city: profile.city ?? undefined,
    bio: profile.bio ?? undefined,
    occupationCategory: profile.occupationCategory ?? undefined,
    occupationDetail: profile.occupationDetail ?? undefined,
    declaredMonthlyIncome: profile.declaredMonthlyIncome ?? undefined,
    monthlyLendingCapacityPaise: profile.monthlyLendingCapacityPaise ?? undefined,
    isComplete,
    createdAt: (profile as ProfileDocument & { createdAt?: Date }).createdAt?.toISOString(),
    updatedAt: (profile as ProfileDocument & { updatedAt?: Date }).updatedAt?.toISOString(),
  };
}

export const profileService = {
  /** Get the authenticated user's profile, creating an empty stub if needed. */
  async getMyProfile(userId: string): Promise<ProfilePayload> {
    let profile = await Profile.findOne({ userId });
    if (!profile) {
      const user = await User.findById(userId);
      if (!user) throw new AppError('user_not_found', 'User no longer exists', 404);
      profile = await Profile.create({ userId, name: user.name });
    }
    return toPayload(profile);
  },

  /** Upsert the authenticated user's profile. Partial — only changes provided fields. */
  async updateMyProfile(
    userId: string,
    input: UpdateProfileInput,
    ctx: AuditContext,
  ): Promise<ProfilePayload> {
    const user = await User.findById(userId);
    if (!user) throw new AppError('user_not_found', 'User no longer exists', 404);

    const existing = await Profile.findOne({ userId });
    const before = existing ? toPayload(existing) : null;

    // If `name` is updated on profile, also sync to User (User.name is the
    // canonical reference for auth-time queries).
    if (input.name && input.name !== user.name) {
      user.name = input.name;
      await user.save();
    }

    const updates: Record<string, unknown> = { name: input.name ?? user.name };
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) updates[k] = v;
    }

    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: updates, $setOnInsert: { userId } },
      { new: true, upsert: true, runValidators: true },
    );

    if (!profile) {
      // Should not happen with upsert, but TypeScript narrowing
      throw new AppError('profile_save_failed', 'Failed to save profile', 500);
    }

    const after = toPayload(profile);

    await writeAudit(ctx, {
      action: existing ? 'profile.updated' : 'profile.created',
      entityType: 'profile',
      entityId: String(profile._id),
      before: before ?? undefined,
      after,
    });

    return after;
  },
};
