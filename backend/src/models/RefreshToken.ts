/**
 * Refresh token storage with rotation chain + theft detection.
 *
 * We never store the raw refresh token — only its SHA-256 hash. The raw
 * token is sent to the client once on issue and never again.
 *
 * Theft detection: every refresh issues a new token AND revokes the previous
 * one. Refresh tokens are linked by `familyId` (a UUID that stays the same
 * across the whole rotation chain). If a revoked token is ever presented for
 * refresh, every token sharing that familyId is revoked (the chain is dead)
 * and the user is force-logged-out. This catches the case where an attacker
 * stole a refresh token and used it — the legitimate user's next refresh
 * trips the alarm.
 *
 * See ARCHITECTURE.md §10.2.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // SHA-256 hash of the raw token. Lookup key.
    tokenHash: { type: String, required: true, unique: true, index: true },

    // UUID shared across the whole rotation chain for theft detection.
    familyId: { type: String, required: true, index: true },

    // Replacement link for chain forensics ("which token replaced this one").
    replacedByTokenHash: { type: String, index: true, sparse: true },

    // Issuance context — for forensics and device-consistency signals.
    deviceFingerprint: { type: String },
    ip: { type: String },
    userAgent: { type: String },

    issuedAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    revokedReason: {
      type: String,
      enum: ['rotated', 'logout', 'theft_detected', 'admin_revoke', 'chain_killed'],
      default: null,
    },
  },
  { timestamps: true },
);

// TTL — auto-delete tokens 30 days after they expire.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export type RefreshTokenDocument = InferSchemaType<typeof refreshTokenSchema> & {
  _id: Schema.Types.ObjectId;
};
export const RefreshToken: Model<RefreshTokenDocument> = model<RefreshTokenDocument>(
  'RefreshToken',
  refreshTokenSchema,
);
