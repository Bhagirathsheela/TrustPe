/**
 * Append-only audit log.
 *
 * Every write that touches money, identity, or auth state produces an entry.
 * No deletes, no updates — only inserts. Retained 5 years per PMLA + RBI norms.
 *
 * See CLAUDE.md "Audit logging — never bypass" and ARCHITECTURE.md §21.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const auditLogSchema = new Schema(
  {
    at: { type: Date, required: true, default: () => new Date(), index: true },

    actorType: {
      type: String,
      required: true,
      enum: ['user', 'admin', 'system', 'webhook'],
      index: true,
    },
    actorId: { type: String, index: true },

    // Dotted action name, e.g. 'user.signup', 'auth.otp.verified', 'loan.disbursed'.
    action: { type: String, required: true, index: true },

    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },

    // JSON snapshots before and after the change. `null` for creates / deletes.
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,

    ip: String,
    deviceFingerprint: String,
    userAgent: String,
    traceId: String,

    // Free-form context: action-specific extras (admin notes, OCR confidence, etc.)
    metadata: Schema.Types.Mixed,
  },
  { versionKey: false },
);

auditLogSchema.index({ entityType: 1, entityId: 1, at: -1 });
auditLogSchema.index({ actorId: 1, at: -1 });

// 5-year TTL on audit records.
auditLogSchema.index({ at: 1 }, { expireAfterSeconds: 5 * 365 * 24 * 60 * 60 });

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema> & {
  _id: Schema.Types.ObjectId;
};
export const AuditLog: Model<AuditLogDocument> = model<AuditLogDocument>(
  'AuditLog',
  auditLogSchema,
);
