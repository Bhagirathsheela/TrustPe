import { z } from 'zod';

/**
 * Dispute resolution actions, picked by an admin reviewing a disputed
 * payment intent.
 *
 *   verify        — admin trusts the payer; intent → verified, loan flow resumes
 *                   (use when bank/UPI records or screenshots show the money moved)
 *   mark_failed   — admin trusts the payee; intent → failed, payer can retry
 *                   (use when payment never actually happened or was reversed)
 *   default_loan  — admin concludes the loan failed and one party is at fault;
 *                   loan → defaulted, defaulter takes a TrustScore penalty,
 *                   appears on the default registry on their public profile
 */
export const disputeResolutionActionSchema = z.enum([
  'verify',
  'mark_failed',
  'default_loan',
]);
export type DisputeResolutionAction = z.infer<typeof disputeResolutionActionSchema>;

export const disputeResolutionSchema = z
  .object({
    action: disputeResolutionActionSchema,
    reason: z
      .string()
      .trim()
      .min(10, 'Provide a brief reason (≥ 10 characters)')
      .max(1000),
    /** Required when action='default_loan' — which party defaulted. */
    defaultBy: z.enum(['borrower', 'lender']).optional(),
  })
  .refine((d) => d.action !== 'default_loan' || !!d.defaultBy, {
    message: 'When defaulting a loan, you must say which party is at fault.',
    path: ['defaultBy'],
  });
export type DisputeResolutionInput = z.infer<typeof disputeResolutionSchema>;

export const disputeQueueQuerySchema = z.object({
  status: z.enum(['disputed', 'resolved']).optional().default('disputed'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});
export type DisputeQueueQuery = z.infer<typeof disputeQueueQuerySchema>;
