/**
 * LoanOffer — one document per offer or counter-offer.
 *
 * A negotiation forms a linked-list via `parentOfferId`:
 *
 *   Lender offer A (pending → countered)
 *      └─ Borrower counter B (pending → countered)
 *            └─ Lender counter C (pending → accepted)
 *
 * When C is accepted, a Loan is created and any other pending offer on the
 * same loanRequest is `auto_rejected`. See loan-offer.service.ts for the
 * transactional logic.
 *
 * Snapshots are denormalised so list views (borrower's "offers on my request",
 * lender's "my offers") don't need a join per row.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const loanOfferSchema = new Schema(
  {
    loanRequestId: { type: Schema.Types.ObjectId, ref: 'LoanRequest', required: true, index: true },

    // The two parties on this negotiation thread. Borrower is always the
    // request author; lender is whoever started the thread.
    borrowerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lenderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Who sent THIS specific offer — alternates on counters.
    senderRole: { type: String, required: true, enum: ['lender', 'borrower'] },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Money terms
    amountPaise: { type: Number, required: true, min: 500_000, max: 5_000_000 },
    tenureMonths: { type: Number, required: true, min: 1, max: 6 },
    roiPercent: { type: Number, required: true, min: 0, max: 36 },
    message: { type: String, maxlength: 500 },

    status: {
      type: String,
      required: true,
      enum: [
        'pending',
        'countered',
        'accepted',
        'rejected',
        'withdrawn',
        'expired',
        'auto_rejected',
      ],
      default: 'pending',
      index: true,
    },

    // Negotiation chain — null for the first offer on a thread.
    parentOfferId: { type: Schema.Types.ObjectId, ref: 'LoanOffer', default: null, index: true },
    // For convenience when traversing — the original offer id, copied through.
    rootOfferId: { type: Schema.Types.ObjectId, ref: 'LoanOffer', required: true, index: true },

    // Both sides see who they're dealing with — snapshot at offer-time so
    // browsing lists are one-query reads.
    senderSnapshot: {
      name: { type: String, required: true },
      city: String,
      trustScore: { type: Number, required: true },
      trustBand: { type: String, required: true },
    },

    sentAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true, index: true },
    respondedAt: Date,
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    responseReason: String,
  },
  { timestamps: true },
);

// Common query paths
loanOfferSchema.index({ loanRequestId: 1, status: 1, sentAt: -1 });
loanOfferSchema.index({ lenderId: 1, status: 1, sentAt: -1 });
loanOfferSchema.index({ borrowerId: 1, status: 1, sentAt: -1 });

export type LoanOfferDocument = InferSchemaType<typeof loanOfferSchema> & {
  _id: Schema.Types.ObjectId;
};
export const LoanOffer: Model<LoanOfferDocument> = model<LoanOfferDocument>(
  'LoanOffer',
  loanOfferSchema,
);
