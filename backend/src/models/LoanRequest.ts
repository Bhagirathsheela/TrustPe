/**
 * LoanRequest model — borrower's published ask.
 *
 * A request lives in the funnel: draft → open → in_negotiation → matched.
 * Each terminal branch (cancelled, expired) closes the request without a
 * loan being created.
 *
 * Indexes are tuned for the lender browse view (status + filters + sort).
 *
 * See ARCHITECTURE.md §6 (state machines) and §11.1 (collections).
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const loanRequestSchema = new Schema(
  {
    // The borrower. Indexed because borrowers query "my requests" frequently.
    borrowerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Money
    amountPaise: { type: Number, required: true, min: 500_000, max: 5_000_000 },
    tenureMonths: { type: Number, required: true, min: 1, max: 6 },
    // Single fixed rate the borrower commits to. Bounded by min(TrustPe
    // global cap, borrower's state cap). State cap enforced in the service.
    roiPercent: { type: Number, required: true, min: 0, max: 36 },

    purpose: {
      type: String,
      required: true,
      enum: [
        'medical',
        'education',
        'home_improvement',
        'business',
        'debt_consolidation',
        'family_event',
        'emergency',
        'travel',
        'electronics',
        'other',
      ],
      index: true,
    },
    purposeDetail: { type: String, maxlength: 500 },

    status: {
      type: String,
      required: true,
      // 'draft' / 'in_negotiation' kept in enum for legacy records; new
      // requests only emit open/matched/cancelled/expired.
      enum: ['draft', 'open', 'in_negotiation', 'matched', 'cancelled', 'expired'],
      default: 'open',
      index: true,
    },

    // Denormalised borrower snapshot at request time — used to power lender
    // browse without an extra join on every row.
    snapshot: {
      borrowerName: { type: String, required: true },
      borrowerCity: { type: String },
      borrowerTrustScore: { type: Number, required: true },
      borrowerTrustBand: { type: String, required: true },
    },

    // Cached counters (kept in sync via service-layer updates; never trust
    // counters for security decisions — always re-query).
    offersCount: { type: Number, default: 0 },

    // Lifecycle timestamps
    publishedAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true, index: true }, // service sets this
    matchedAt: Date,
    cancelledAt: Date,
    cancelledReason: String,
  },
  { timestamps: true },
);

// Browse query: status='open' + sort by createdAt or amount, optionally filtered
// by purpose / amount range. The compound indexes below cover the common paths.
loanRequestSchema.index({ status: 1, publishedAt: -1 });
loanRequestSchema.index({ status: 1, amountPaise: 1 });
loanRequestSchema.index({ status: 1, tenureMonths: 1 });
loanRequestSchema.index({ status: 1, purpose: 1, publishedAt: -1 });
// Borrower's "mine" view: filter by borrowerId + status, newest first.
loanRequestSchema.index({ borrowerId: 1, publishedAt: -1 });
// At most ONE open request per borrower — DB-level backup for the service
// check (findOne-then-create is racy without this).
loanRequestSchema.index(
  { borrowerId: 1 },
  { unique: true, partialFilterExpression: { status: 'open' }, name: 'uniq_open_request_per_borrower' },
);

export type LoanRequestDocument = InferSchemaType<typeof loanRequestSchema> & {
  _id: Schema.Types.ObjectId;
};
export const LoanRequest: Model<LoanRequestDocument> = model<LoanRequestDocument>(
  'LoanRequest',
  loanRequestSchema,
);
