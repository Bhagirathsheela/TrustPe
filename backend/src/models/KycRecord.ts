/**
 * KycRecord model — one document per user, holds their KYC submission and
 * the admin's review decision.
 *
 * Document storage: Cloudinary public IDs only — we never persist raw image
 * bytes in Mongo. We also do NOT store the Aadhaar number at all (Aadhaar
 * Act §29). The full number is visible on the uploaded Aadhaar image, which
 * is enough for the admin to verify on UIDAI's public portal.
 *
 * See ARCHITECTURE.md §11.1 + §2.3.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const kycSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    // Identity numbers — only PAN is persisted. Aadhaar number lives only on
    // the uploaded image (encrypted at rest in Cloudinary).
    pan: { type: String, required: true, uppercase: true, trim: true, index: true },

    // Cloudinary document references
    aadhaarFrontCloudinaryId: { type: String, required: true },
    aadhaarBackCloudinaryId: { type: String, required: true },
    panFrontCloudinaryId: { type: String, required: true },
    selfieVideoCloudinaryId: { type: String, required: true },

    // Primary UPI ID — used for disbursement and EMI in Sprint 3. Verified by
    // the admin via free NPCI name-lookup in their own UPI app at review time.
    vpa: { type: String, required: true, lowercase: true, trim: true, index: true },
    vpaVerificationMethod: {
      type: String,
      required: true,
      enum: ['ocr_screenshot_auto', 'admin_manual', 'reverse_penny_drop', 'cashfree_penny_drop'],
      default: 'admin_manual',
    },

    // Review state
    status: {
      type: String,
      required: true,
      enum: ['submitted', 'approved', 'rejected', 'needs_clarification'],
      default: 'submitted',
      index: true,
    },
    submittedAt: { type: Date, required: true, default: () => new Date() },
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewerNotes: String,
  },
  { timestamps: true },
);

kycSchema.index({ status: 1, submittedAt: 1 });

export type KycRecordDocument = InferSchemaType<typeof kycSchema> & {
  _id: Schema.Types.ObjectId;
};
export const KycRecord: Model<KycRecordDocument> = model<KycRecordDocument>(
  'KycRecord',
  kycSchema,
);
