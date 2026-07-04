import { z } from 'zod';

/**
 * Agreement signing state.
 *
 *   awaiting_signatures — neither party has signed
 *   awaiting_lender     — borrower signed, lender hasn't
 *   awaiting_borrower   — lender signed, borrower hasn't
 *   signed              — both signed; loan can move to awaiting_disbursal
 *   void                — explicitly invalidated (admin tool, future)
 */
export const agreementStatusSchema = z.enum([
  'awaiting_signatures',
  'awaiting_lender',
  'awaiting_borrower',
  'signed',
  'void',
]);
export type AgreementStatus = z.infer<typeof agreementStatusSchema>;

/**
 * Click-wrap sign payload. The viewer just confirms; everything else
 * (party identity, terms, hash) is server-side. Mobile sends a small
 * device fingerprint string for the audit record.
 */
export const signAgreementSchema = z.object({
  deviceFingerprint: z.string().trim().max(256).optional(),
  /** Echo of the body hash the client rendered — server compares to detect drift. */
  expectedBodyHash: z.string().trim().length(64).optional(),
});
export type SignAgreementInput = z.infer<typeof signAgreementSchema>;
