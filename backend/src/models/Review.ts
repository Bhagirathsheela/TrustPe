/**
 * Review model — one per (loan, reviewer). Borrower reviews lender and
 * lender reviews borrower after the loan closes; both write into this
 * collection.
 *
 * The `scoreDelta` field freezes the impact this review had on the
 * reviewee's TrustScore at submission time, so reversing/removing the
 * review later (admin moderation) can cleanly subtract the same delta.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const reviewSchema = new Schema(
  {
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    revieweeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /** Reviewer's role IN THIS LOAN (so the UI can show "as borrower" / "as lender"). */
    reviewerRole: { type: String, enum: ['borrower', 'lender'], required: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 500 },
    tags: { type: [String], default: [] },

    /** Snapshot of reviewer for cheap list rendering. */
    reviewerSnapshot: {
      name: { type: String, required: true },
      trustScore: { type: Number, required: true },
      trustBand: { type: String, required: true },
    },

    /** Numeric delta applied to the reviewee's TrustScore at submission. */
    scoreDelta: { type: Number, required: true },

    /** Soft moderation flags. Hidden reviews don't appear in public lists. */
    flagged: { type: Boolean, default: false, index: true },
    hidden: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// Enforces one review per (loan, reviewer).
reviewSchema.index({ loanId: 1, reviewerId: 1 }, { unique: true });
// Common "reviews about a user" query.
reviewSchema.index({ revieweeId: 1, hidden: 1, createdAt: -1 });

export type ReviewDocument = InferSchemaType<typeof reviewSchema> & {
  _id: Schema.Types.ObjectId;
};
export const Review: Model<ReviewDocument> = model<ReviewDocument>('Review', reviewSchema);
