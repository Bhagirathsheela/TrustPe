import { z } from 'zod';

/**
 * Curated review tags. Two flavours mixed in one enum — the UI shows the
 * appropriate subset based on the reviewer's role in the loan.
 *
 * Lender-on-borrower (positive): paid_on_time, communicated_well, honest, trustworthy
 * Lender-on-borrower (negative): late_payment, dodged_questions, partial_default
 *
 * Borrower-on-lender (positive): disbursed_quickly, fair_terms, patient, supportive
 * Borrower-on-lender (negative): slow_to_disburse, unclear_communication, pressuring
 */
export const reviewTagSchema = z.enum([
  // Lender → borrower
  'paid_on_time',
  'communicated_well',
  'honest',
  'trustworthy',
  'late_payment',
  'dodged_questions',
  'partial_default',
  // Borrower → lender
  'disbursed_quickly',
  'fair_terms',
  'patient',
  'supportive',
  'slow_to_disburse',
  'unclear_communication',
  'pressuring',
]);
export type ReviewTag = z.infer<typeof reviewTagSchema>;

export const REVIEW_TAG_LABELS: Record<ReviewTag, string> = {
  paid_on_time: 'Paid on time',
  communicated_well: 'Communicated well',
  honest: 'Honest',
  trustworthy: 'Trustworthy',
  late_payment: 'Late payment',
  dodged_questions: 'Dodged questions',
  partial_default: 'Partial default',
  disbursed_quickly: 'Disbursed quickly',
  fair_terms: 'Fair terms',
  patient: 'Patient',
  supportive: 'Supportive',
  slow_to_disburse: 'Slow to disburse',
  unclear_communication: 'Unclear communication',
  pressuring: 'Pressuring',
};

/** Tags appropriate for a lender reviewing the borrower. */
export const LENDER_ON_BORROWER_TAGS: ReviewTag[] = [
  'paid_on_time',
  'communicated_well',
  'honest',
  'trustworthy',
  'late_payment',
  'dodged_questions',
  'partial_default',
];

/** Tags appropriate for a borrower reviewing the lender. */
export const BORROWER_ON_LENDER_TAGS: ReviewTag[] = [
  'disbursed_quickly',
  'fair_terms',
  'patient',
  'supportive',
  'slow_to_disburse',
  'unclear_communication',
  'pressuring',
];

export const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
  tags: z.array(reviewTagSchema).max(5).optional(),
});
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

export const reviewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  before: z.string().optional(),
});
export type ReviewQuery = z.infer<typeof reviewQuerySchema>;
