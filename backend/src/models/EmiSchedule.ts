/**
 * EmiSchedule — generated once per Loan when the disbursal is verified.
 *
 * Simple-interest math, matching what the agreement document quotes. Each
 * installment carries due date, principal portion, interest portion, total
 * amount, and current settlement status. A pointer to the PaymentIntent
 * that settled it (when paid) keeps the audit chain intact.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const installmentSchema = new Schema(
  {
    emiNumber: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    principalPaise: { type: Number, required: true },
    interestPaise: { type: Number, required: true },
    amountPaise: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue'],
      default: 'pending',
      required: true,
    },
    paidPaymentIntentId: { type: Schema.Types.ObjectId, ref: 'PaymentIntent' },
    paidAt: Date,
    /** Reminder kinds already sent for this installment — keeps the cron
     *  idempotent across re-runs and server restarts. */
    reminderSentKinds: { type: [String], default: [] },
  },
  { _id: false },
);

const emiScheduleSchema = new Schema(
  {
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, unique: true, index: true },
    totalMonths: { type: Number, required: true },
    startDate: { type: Date, required: true },
    /** Snapshot of the per-EMI amount; convenience for quick lookups. */
    monthlyAmountPaise: { type: Number, required: true },
    /** Snapshot of total interest; same. */
    totalInterestPaise: { type: Number, required: true },
    installments: { type: [installmentSchema], required: true },
  },
  { timestamps: true },
);

export type EmiScheduleDocument = InferSchemaType<typeof emiScheduleSchema> & {
  _id: Schema.Types.ObjectId;
};
export const EmiSchedule: Model<EmiScheduleDocument> = model<EmiScheduleDocument>(
  'EmiSchedule',
  emiScheduleSchema,
);
