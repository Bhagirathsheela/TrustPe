/**
 * Loan — created at the moment an offer is accepted.
 *
 * Sprint 2B emits status='awaiting_disbursal' only. Subsequent sprints fill
 * out the full state machine (agreement → disbursal → active → closed).
 *
 * See ARCHITECTURE.md §6 (state machines) and §11.1 (collections).
 */
import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

const loanSchema = new Schema(
  {
    loanRequestId: { type: Schema.Types.ObjectId, ref: 'LoanRequest', required: true, index: true },
    acceptedOfferId: { type: Schema.Types.ObjectId, ref: 'LoanOffer', required: true, unique: true },

    borrowerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lenderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Agreed money terms — locked in at acceptance.
    amountPaise: { type: Number, required: true, min: 500_000, max: 5_000_000 },
    tenureMonths: { type: Number, required: true, min: 1, max: 6 },
    roiPercent: { type: Number, required: true, min: 0, max: 36 },

    status: {
      type: String,
      required: true,
      enum: [
        'awaiting_disbursal',
        'awaiting_agreement',
        'active',
        'closed',
        'defaulted',
        'cancelled',
      ],
      default: 'awaiting_agreement',
      index: true,
    },

    // Snapshots of both parties for fast loan-list rendering.
    borrowerSnapshot: {
      name: { type: String, required: true },
      city: String,
      trustScore: { type: Number, required: true },
      trustBand: { type: String, required: true },
    },
    lenderSnapshot: {
      name: { type: String, required: true },
      city: String,
      trustScore: { type: Number, required: true },
      trustBand: { type: String, required: true },
    },

    // Lifecycle timestamps
    agreedAt: { type: Date, required: true, default: () => new Date() },
    disbursedAt: Date,
    closedAt: Date,
    cancelledAt: Date,
    defaultedAt: Date,
    defaultedBy: { type: String, enum: ['borrower', 'lender'] },
    defaultReason: String,

    // Set in Sprint 2D when the agreement PDF lands.
    agreementId: { type: Schema.Types.ObjectId, ref: 'Agreement' },
  },
  { timestamps: true },
);

// "My loans" common queries
loanSchema.index({ borrowerId: 1, status: 1, agreedAt: -1 });
loanSchema.index({ lenderId: 1, status: 1, agreedAt: -1 });

// HydratedDocument gives us the schema-typed fields plus Mongoose's
// runtime methods (save, deleteOne, populate, etc.) on returned documents.
export type LoanDocument = HydratedDocument<InferSchemaType<typeof loanSchema>>;
export const Loan: Model<InferSchemaType<typeof loanSchema>> = model('Loan', loanSchema);
