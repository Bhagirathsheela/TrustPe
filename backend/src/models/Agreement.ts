/**
 * Agreement model — one document per Loan.
 *
 * Phase 1 approach: the canonical "agreement text" is a deterministic
 * function of the loan + parties + timestamp (see agreement.service.ts).
 * We hash the body at first-render time and at each signature, store the
 * hash, IP, device fingerprint, user agent, and timestamp. Two matching
 * hashes across both signers and the cached generation is the integrity
 * proof.
 *
 * PDF generation (PDFKit) is deferred — the same body string can be
 * rendered to PDF later for download without changing the hash.
 *
 * IT Act §10A enforceability: identifying both parties, capturing intent
 * via affirmative action (scroll-locked Accept button + dialog), and
 * preserving the document hash + IP + timestamp.
 */
import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const signatureSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    signedAt: { type: Date, required: true },
    ip: String,
    userAgent: String,
    deviceFingerprint: String,
    bodyHash: { type: String, required: true }, // SHA-256 hex of the body at sign time
    traceId: String,
  },
  { _id: false },
);

const agreementSchema = new Schema(
  {
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, unique: true, index: true },
    borrowerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lenderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /** Canonical body — recomputed from loan + parties, stored at create time so
     *  re-renders show the same content even if upstream snapshots change. */
    bodyText: { type: String, required: true },
    /** SHA-256 hex of bodyText at generation. Re-hashing bodyText must match. */
    bodyHash: { type: String, required: true },

    status: {
      type: String,
      required: true,
      enum: ['awaiting_signatures', 'awaiting_lender', 'awaiting_borrower', 'signed', 'void'],
      default: 'awaiting_signatures',
      index: true,
    },

    borrowerSignature: signatureSchema,
    lenderSignature: signatureSchema,

    generatedAt: { type: Date, required: true, default: () => new Date() },
    signedAt: Date,
    voidedAt: Date,
    voidedReason: String,
  },
  { timestamps: true },
);

export type AgreementDocument = InferSchemaType<typeof agreementSchema> & {
  _id: Schema.Types.ObjectId;
};
export const Agreement: Model<AgreementDocument> = model<AgreementDocument>(
  'Agreement',
  agreementSchema,
);
