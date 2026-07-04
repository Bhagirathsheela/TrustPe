import { z } from 'zod';

/**
 * Loan state machine — Sprint 2B only emits `awaiting_disbursal`. Later
 * sprints add active (after disbursal), closed (paid off), defaulted, etc.
 *
 *   awaiting_disbursal — offer accepted; lender hasn't sent funds yet
 *   awaiting_agreement — agreement PDF is generated but not yet click-wrap accepted (Sprint 2D)
 *   active             — funds disbursed, EMIs ticking (Sprint 3)
 *   closed             — fully repaid
 *   defaulted          — borrower missed sufficient EMIs (Sprint 4)
 *   cancelled          — admin cancelled before disbursal
 */
export const loanStatusSchema = z.enum([
  'awaiting_disbursal',
  'awaiting_agreement',
  'active',
  'closed',
  'defaulted',
  'cancelled',
]);
export type LoanStatus = z.infer<typeof loanStatusSchema>;

/** Mine query — borrower OR lender lens. */
export const myLoansQuerySchema = z.object({
  role: z.enum(['borrower', 'lender', 'either']).optional().default('either'),
  status: loanStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type MyLoansQuery = z.infer<typeof myLoansQuerySchema>;
