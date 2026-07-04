/**
 * Auth service — signup, OTP verify, refresh rotation with theft detection.
 *
 * Controllers stay thin (parse → call one method here → format response).
 * See ARCHITECTURE.md §6.3 controller/service split and §10.2 token model.
 */
import { startSession } from 'mongoose';
import { AppError } from '../middleware/error-handler.js';
import { User, type UserDocument } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { writeAudit, type AuditContext } from '../utils/audit.js';
import {
  generateFamilyId,
  generateOtp,
  generateRefreshToken,
  hashSha256,
} from '../utils/crypto.js';
import { signAccessToken } from '../utils/jwt.js';
import { otpStoreService } from './otp-store.service.js';
import { emailService } from './email.service.js';
import type { SignupInput, VerifyOtpInput, LoginInput } from 'trustpe-shared';

type IssueTokensOptions = {
  user: UserDocument;
  ctx: AuditContext;
  familyId?: string; // when rotating, carry the existing family forward
};

async function issueTokenPair({ user, ctx, familyId }: IssueTokensOptions) {
  const family = familyId ?? generateFamilyId();
  const rawRefresh = generateRefreshToken();
  const refreshHash = hashSha256(rawRefresh);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: refreshHash,
    familyId: family,
    deviceFingerprint: ctx.deviceFingerprint,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    expiresAt: refreshExpiresAt,
  });

  const { token: accessToken, expiresAt: accessExpiresAt } = signAccessToken({
    sub: String(user._id),
    roles: user.roles as Array<UserDocument['roles'][number]>,
    kycStatus: user.kycStatus,
  });

  return { accessToken, refreshToken: rawRefresh, accessExpiresAt, familyId: family };
}

export const authService = {
  /**
   * Sign up a new user OR re-issue an OTP for an existing unverified one.
   * Returns just an opaque "OTP sent" acknowledgement — we never reveal whether
   * the email was new or existing (information disclosure).
   */
  async signup(input: SignupInput, ctx: AuditContext): Promise<{ email: string }> {
    const existing = await User.findOne({
      $or: [{ email: input.email }, { phone: input.phone }],
    });

    let user = existing;

    if (existing) {
      // Already verified → still send an OTP via the login flow shape (treat as login attempt)
      // but only if the same email is reused. If phone matches a different email, reject.
      if (existing.email !== input.email) {
        throw new AppError(
          'phone_already_registered',
          'This phone number is already linked to a different email',
          409,
        );
      }
    } else {
      user = await User.create({
        phone: input.phone,
        email: input.email,
        name: input.name,
        status: 'unverified',
        kycStatus: 'not_started',
        roles: ['user'],
        trustScore: 300,
        trustBand: 'building',
      });

      await writeAudit(ctx, {
        action: 'user.signup',
        entityType: 'user',
        entityId: String(user._id),
        after: { phone: user.phone, email: user.email, name: user.name, status: user.status },
      });
    }

    const otp = generateOtp();
    otpStoreService.set(input.email, otp);
    try {
      await emailService.sendOtp(input.email, otp, 'signup');
    } catch (err) {
      // Roll the OTP back so the user can retry cleanly rather than
      // hitting "code expired" or "no OTP pending" on the next attempt.
      otpStoreService.clear(input.email);
      throw new AppError(
        'otp_delivery_failed',
        "We couldn't send the code to that email address right now. Please try again in a moment.",
        502,
        { cause: err instanceof Error ? err.message : String(err) },
      );
    }

    return { email: input.email };
  },

  /**
   * Send a fresh OTP to an existing user's email. Used for returning-user login.
   * If the email doesn't match a user, returns the same shape (no info disclosure).
   */
  async login(input: LoginInput): Promise<{ email: string }> {
    const user = await User.findOne({ email: input.email });
    if (user) {
      const otp = generateOtp();
      otpStoreService.set(input.email, otp);
      try {
        await emailService.sendOtp(input.email, otp, 'login');
      } catch (err) {
        // Don't leak the failure to the caller (would confirm the email
        // exists); log it, roll back the OTP, and let the user retry.
        otpStoreService.clear(input.email);
        logger.warn({ err, email: input.email }, '[auth.login] OTP delivery failed');
      }
    }
    return { email: input.email };
  },

  /**
   * Verify the OTP and issue access + refresh tokens.
   */
  async verifyOtp(input: VerifyOtpInput, ctx: AuditContext) {
    const result = otpStoreService.verify(input.email, input.otp);
    if (result !== 'verified') {
      const messageByResult = {
        not_found: 'No OTP pending for this email. Please request a new one.',
        incorrect: 'Incorrect code. Please try again.',
        expired: 'This code has expired. Please request a new one.',
        too_many_attempts: 'Too many attempts. Please request a new code.',
      } as const;
      throw new AppError('otp_' + result, messageByResult[result], 400);
    }

    const user = await User.findOne({ email: input.email });
    if (!user) {
      throw new AppError('user_not_found', 'No account exists for this email', 404);
    }

    // First-time verification → move user from 'unverified' to 'onboarding'.
    let statusChange: { before: string; after: string } | null = null;
    if (user.status === 'unverified') {
      statusChange = { before: user.status, after: 'onboarding' };
      user.status = 'onboarding';
      await user.save();
    }

    const tokens = await issueTokenPair({ user, ctx });

    await writeAudit(ctx, {
      action: 'auth.otp.verified',
      entityType: 'user',
      entityId: String(user._id),
      ...(statusChange
        ? { before: { status: statusChange.before }, after: { status: statusChange.after } }
        : {}),
      metadata: { familyId: tokens.familyId },
    });

    return { ...tokens, user };
  },

  /**
   * Exchange a refresh token for a new pair. Rotation chain + theft detection
   * per ARCHITECTURE.md §10.2.
   */
  async refresh(rawRefresh: string, ctx: AuditContext) {
    const tokenHash = hashSha256(rawRefresh);
    const stored = await RefreshToken.findOne({ tokenHash });
    if (!stored) {
      // Could be: never existed, expired-and-TTL'd, or already chain-killed.
      throw new AppError('refresh_invalid', 'Refresh token is invalid', 401);
    }

    // THEFT DETECTION: a revoked-but-replayed token kills the whole family.
    if (stored.revokedAt) {
      await RefreshToken.updateMany(
        { familyId: stored.familyId, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: 'chain_killed' } },
      );
      await writeAudit(ctx, {
        action: 'auth.refresh.theft_detected',
        entityType: 'user',
        entityId: String(stored.userId),
        metadata: { familyId: stored.familyId, replayedHashPrefix: tokenHash.slice(0, 12) },
      });
      throw new AppError(
        'refresh_chain_killed',
        'Your session has been invalidated for security reasons. Please log in again.',
        401,
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new AppError('refresh_expired', 'Refresh token has expired', 401);
    }

    const user = await User.findById(stored.userId);
    if (!user) {
      throw new AppError('user_not_found', 'User no longer exists', 404);
    }

    // Atomically: revoke this one, issue the next (same family).
    const session = await startSession();
    try {
      let tokens!: Awaited<ReturnType<typeof issueTokenPair>>;
      await session.withTransaction(async () => {
        tokens = await issueTokenPair({ user, ctx, familyId: stored.familyId });
        await RefreshToken.updateOne(
          { _id: stored._id },
          {
            $set: {
              revokedAt: new Date(),
              revokedReason: 'rotated',
              replacedByTokenHash: hashSha256(tokens.refreshToken),
            },
          },
          { session },
        );
      });
      return { ...tokens, user };
    } finally {
      await session.endSession();
    }
  },

  /** Logout — revoke a single refresh token without killing the chain. */
  async logout(rawRefresh: string | undefined, ctx: AuditContext): Promise<void> {
    if (!rawRefresh) return;
    const tokenHash = hashSha256(rawRefresh);
    const result = await RefreshToken.updateOne(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'logout' } },
    );
    if (result.modifiedCount > 0) {
      const stored = await RefreshToken.findOne({ tokenHash });
      if (stored) {
        await writeAudit(ctx, {
          action: 'auth.logout',
          entityType: 'user',
          entityId: String(stored.userId),
          metadata: { familyId: stored.familyId },
        });
      }
    }
  },
};
