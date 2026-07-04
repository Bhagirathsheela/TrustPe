import { z } from 'zod';

/**
 * Offer state machine.
 *
 * With the fixed-rate model, the negotiation phases are gone. A lender
 * either funds the request at the borrower's published terms (status
 * jumps directly to `accepted` and a Loan is created in the same
 * transaction), or doesn't. The remaining terminal states stay for legacy
 * record-keeping and to leave a path open for Phase 2 if/when a negotiation
 * surface returns.
 *
 *   accepted       — lender funded; a Loan was created
 *   rejected       — borrower cancelled the request after this lender clicked Fund (rare)
 *   withdrawn      — currently unused (fixed-rate has no pending state)
 *   expired        — currently unused
 *   auto_rejected  — sibling-offer protection (concurrent fund attempts that lose the race)
 *   pending        — kept for legacy dev DB records; new flow doesn't emit
 *   countered      — kept for legacy dev DB records; new flow doesn't emit
 */
export const loanOfferStatusSchema = z.enum([
  'pending',
  'countered',
  'accepted',
  'rejected',
  'withdrawn',
  'expired',
  'auto_rejected',
]);
export type LoanOfferStatus = z.infer<typeof loanOfferStatusSchema>;

/**
 * Fund a loan request at the borrower's published terms.
 *
 * No money fields — those come from the LoanRequest. The lender only
 * supplies an optional message ("happy to help, take care").
 */
export const fundRequestSchema = z.object({
  message: z.string().trim().max(500).optional(),
});
export type FundRequestInput = z.infer<typeof fundRequestSchema>;

/** Reject / withdraw can carry an optional reason. */
export const offerReasonSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type OfferReasonInput = z.infer<typeof offerReasonSchema>;
