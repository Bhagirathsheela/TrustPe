import { z } from 'zod';
import {
  MIN_LOAN_AMOUNT_PAISE,
  MAX_LOAN_AMOUNT_PAISE,
  MIN_LOAN_TENURE_MONTHS,
  MAX_LOAN_TENURE_MONTHS,
  MAX_LOAN_ROI_PERCENT,
} from '../constants/index.js';

/**
 * Loan purpose categories. Curated list — borrowers pick one; lenders can
 * filter the browse view by purpose.
 *
 * 'other' requires the borrower to fill in `purposeDetail` so admin + lenders
 * have context.
 */
export const loanPurposeSchema = z.enum([
  'medical',
  'education',
  'home_improvement',
  'business',
  'debt_consolidation',
  'family_event',
  'emergency',
  'travel',
  'electronics',
  'other',
]);
export type LoanPurpose = z.infer<typeof loanPurposeSchema>;

export const LOAN_PURPOSE_LABELS: Record<LoanPurpose, string> = {
  medical: 'Medical / health',
  education: 'Education / fees',
  home_improvement: 'Home repair / improvement',
  business: 'Business / working capital',
  debt_consolidation: 'Debt consolidation',
  family_event: 'Family event (wedding, etc.)',
  emergency: 'Emergency',
  travel: 'Travel',
  electronics: 'Phone / laptop / electronics',
  other: 'Other',
};

/**
 * Loan request state machine.
 *
 *   open       — visible in lender browse; can be funded
 *   matched    — a lender funded; loan was created; this request is closed
 *   cancelled  — borrower cancelled before being funded
 *   expired    — auto-expired after N days without a match (Phase 1 = 30 days)
 *
 * The intermediate `in_negotiation` state from the old counter-offer model
 * is gone — fixed-rate funding means there's no negotiation period.
 */
export const loanRequestStatusSchema = z.enum([
  'open',
  'matched',
  'cancelled',
  'expired',
]);
export type LoanRequestStatus = z.infer<typeof loanRequestStatusSchema>;

/**
 * Base shape — kept as a plain ZodObject so it stays composable.
 * `.refine()` returns a ZodEffects which can't be `.partial()`-ed, so we
 * apply refinements at export time on the create variant and re-use the
 * bare object for the update (PATCH) variant.
 */
const loanRequestFieldsSchema = z.object({
  amountPaise: z
    .number()
    .int()
    .min(MIN_LOAN_AMOUNT_PAISE, `Minimum loan amount is ₹${MIN_LOAN_AMOUNT_PAISE / 100}`)
    .max(MAX_LOAN_AMOUNT_PAISE, `Maximum loan amount is ₹${MAX_LOAN_AMOUNT_PAISE / 100}`),
  tenureMonths: z
    .number()
    .int()
    .min(MIN_LOAN_TENURE_MONTHS)
    .max(MAX_LOAN_TENURE_MONTHS),
  /**
   * Single fixed interest rate the borrower commits to paying. Lenders see
   * this rate and either fund or move on — no counter-offers. Bound by the
   * lower of (TrustPe's MAX_LOAN_ROI_PERCENT, the borrower's state cap from
   * STATE_ROI_CAPS_PERCENT). State cap enforcement happens server-side at
   * create time since the schema doesn't know the borrower's state.
   */
  roiPercent: z.number().min(0).max(MAX_LOAN_ROI_PERCENT),
  purpose: loanPurposeSchema,
  // Free-text — required when purpose is 'other', optional otherwise.
  purposeDetail: z.string().trim().max(500).optional(),
});

/** Create a new loan request. */
export const createLoanRequestSchema = loanRequestFieldsSchema.refine(
  (data) => data.purpose !== 'other' || (data.purposeDetail && data.purposeDetail.length >= 10),
  {
    message: "When purpose is 'other', please describe it (at least 10 characters)",
    path: ['purposeDetail'],
  },
);
export type CreateLoanRequestInput = z.infer<typeof createLoanRequestSchema>;

/**
 * Update an existing loan request (allowed only while status='open' and no
 * funds yet). All fields optional.
 */
export const updateLoanRequestSchema = loanRequestFieldsSchema.partial().refine(
  (data) =>
    !data.purpose ||
    data.purpose !== 'other' ||
    (data.purposeDetail && data.purposeDetail.length >= 10),
  {
    message: "When purpose is 'other', please describe it (at least 10 characters)",
    path: ['purposeDetail'],
  },
);
export type UpdateLoanRequestInput = z.infer<typeof updateLoanRequestSchema>;

/** Lender browse / search query. */
export const loanRequestQuerySchema = z.object({
  purpose: loanPurposeSchema.optional(),
  minAmountPaise: z.coerce.number().int().optional(),
  maxAmountPaise: z.coerce.number().int().optional(),
  minTenure: z.coerce.number().int().optional(),
  maxTenure: z.coerce.number().int().optional(),
  city: z.string().optional(),
  minTrustScore: z.coerce.number().int().min(300).max(900).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
  sort: z.enum(['newest', 'oldest', 'amount_asc', 'amount_desc']).optional().default('newest'),
});
export type LoanRequestQuery = z.infer<typeof loanRequestQuerySchema>;
