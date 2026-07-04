/**
 * Message model — one chat message inside a loan thread.
 *
 * Each Loan has implicit 1:1 chat between borrower + lender; we don't need a
 * separate ChatThread document. Messages are keyed by `loanId` and listed
 * chronologically. System messages from later sprints (payments,
 * attestations, agreement signing) post into the same collection via
 * `senderRole='system'` and a populated `metadata` payload.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const messageSchema = new Schema(
  {
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },

    // For text messages, senderId is the user's id and senderRole is borrower|lender.
    // For system messages, senderId is null and senderRole='system'.
    senderId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    senderRole: {
      type: String,
      required: true,
      enum: ['borrower', 'lender', 'system'],
    },

    kind: {
      type: String,
      required: true,
      enum: [
        'text',
        'system_disbursal',
        'system_payment_marked',
        'system_payment_attested',
        'system_loan_signed',
        'system_loan_closed',
      ],
      default: 'text',
    },

    content: { type: String, required: true, maxlength: 2000 },

    // Free-form payload for system messages: txnId, amountPaise, etc.
    metadata: { type: Schema.Types.Mixed, default: null },

    createdAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  // We manage createdAt ourselves so the index above is straightforward.
  { timestamps: { createdAt: false, updatedAt: true } },
);

messageSchema.index({ loanId: 1, createdAt: -1 });

export type MessageDocument = InferSchemaType<typeof messageSchema> & {
  _id: Schema.Types.ObjectId;
};
export const Message: Model<MessageDocument> = model<MessageDocument>('Message', messageSchema);
