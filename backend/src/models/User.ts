/**
 * User model — identity + status.
 *
 * Profile (photo, bio, occupation) lives in a separate `Profile` collection
 * to keep this hot collection small for auth-time queries.
 *
 * See ARCHITECTURE.md §11.1 (collection inventory) and §12 (TrustScore).
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const userSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    handle: { type: String, unique: true, sparse: true, index: true },

    status: {
      type: String,
      required: true,
      enum: ['unverified', 'onboarding', 'pending_review', 'active', 'suspended'],
      default: 'unverified',
      index: true,
    },
    kycStatus: {
      type: String,
      required: true,
      enum: ['not_started', 'submitted', 'approved', 'rejected', 'needs_clarification'],
      default: 'not_started',
      index: true,
    },
    roles: {
      type: [String],
      enum: ['user', 'super_admin', 'admin', 'support', 'compliance', 'finance'],
      default: ['user'],
    },

    // TrustScore — CIBIL-style 300-900. New users start at 300 (Building band),
    // jump to 550 (Fair) on KYC approval, then move from there with events.
    trustScore: { type: Number, default: 300, min: 300, max: 900 },
    trustBand: {
      type: String,
      enum: ['building', 'fair', 'good', 'very_good', 'excellent'],
      default: 'building',
    },

    // Suspension metadata for audit + recovery
    suspendedAt: Date,
    suspendedReason: String,

    // Notification preferences — list of muted categories
    // (loan_activity, payments, emi_reminders, reviews, kyc, disputes).
    // Push delivery checks this; the in-app feed always records so users
    // can review history.
    notificationPreferences: {
      mutedCategories: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

userSchema.index({ status: 1, createdAt: -1 });

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };
export const User: Model<UserDocument> = model<UserDocument>('User', userSchema);
