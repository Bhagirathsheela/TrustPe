/**
 * PaymentIntent — one document per planned payment.
 *
 * Created when:
 *   - Lender initiates disbursal (kind='disbursal')
 *   - Borrower initiates an EMI payment (kind='emi', emiNumber set)
 *   - Borrower initiates a preclose (kind='preclose', Phase 2)
 *
 * Lifecycle:
 *   awaiting_payer_evidence → payer_confirmed → verified
 *
 * The intent carries a referenceId (UUID) that becomes the `tr` param in the
 * upi:// URL. Once we move to a dev client + native Intent return module,
 * the same ref is what we'll match the UPI app's response against.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';
import crypto from 'node:crypto';

const payerEvidenceSchema = new Schema(
  {
    utr: String,
    amountConfirmed: Boolean,
    note: String,
    submittedAt: Date,
    ip: String,
    deviceFingerprint: String,
  },
  { _id: false },
);

const receiverAttestationSchema = new Schema(
  {
    decision: { type: String, enum: ['received', 'not_received'] },
    reason: String,
    submittedAt: Date,
    ip: String,
  },
  { _id: false },
);

const paymentIntentSchema = new Schema(
  {
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },

    kind: { type: String, enum: ['disbursal', 'emi', 'preclose'], required: true, index: true },
    /** For kind='emi', the 1-based EMI installment this intent settles. */
    emiNumber: { type: Number },

    payerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    payeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    payerVpa: { type: String, required: true },
    payeeVpa: { type: String, required: true },
    payeeName: { type: String, required: true },

    amountPaise: { type: Number, required: true, min: 1 },

    /** Used as the `tr` param in upi://pay so we can match the UPI app's return. */
    referenceId: { type: String, required: true, unique: true, default: () => crypto.randomUUID() },

    status: {
      type: String,
      enum: [
        'awaiting_payer_evidence',
        'payer_confirmed',
        'verified',
        'failed',
        'expired',
        'disputed',
      ],
      default: 'awaiting_payer_evidence',
      required: true,
      index: true,
    },

    payerEvidence: payerEvidenceSchema,
    receiverAttestation: receiverAttestationSchema,

    failureReason: String,

    createdAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    payerConfirmedAt: Date,
    verifiedAt: Date,
    failedAt: Date,
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

paymentIntentSchema.index({ loanId: 1, kind: 1, emiNumber: 1 });
// At most ONE open intent per (loan, kind, emiNumber) — DB-level backup for
// the findOne-then-create in payment.service against concurrent initiations.
paymentIntentSchema.index(
  { loanId: 1, kind: 1, emiNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['awaiting_payer_evidence', 'payer_confirmed'] } },
    name: 'uniq_open_intent_per_loan_kind_emi',
  },
);
paymentIntentSchema.index({ payerId: 1, status: 1, createdAt: -1 });
paymentIntentSchema.index({ payeeId: 1, status: 1, createdAt: -1 });

export type PaymentIntentDocument = InferSchemaType<typeof paymentIntentSchema> & {
  _id: Schema.Types.ObjectId;
};
export const PaymentIntent: Model<PaymentIntentDocument> = model<PaymentIntentDocument>(
  'PaymentIntent',
  paymentIntentSchema,
);
