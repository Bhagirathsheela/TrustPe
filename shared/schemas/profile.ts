import { z } from 'zod';
import { MIN_LOAN_AMOUNT_PAISE, MAX_LOAN_AMOUNT_PAISE } from '../constants/index';

/** Declared monthly income bands (no salary slip required at Phase 1). */
export const incomeBandSchema = z.enum([
  'under_10k',
  '10k_25k',
  '25k_50k',
  '50k_1L',
  '1L_2L',
  'over_2L',
]);
export type IncomeBand = z.infer<typeof incomeBandSchema>;

/** Broad occupation categories — covers formal + informal workers. */
export const occupationCategorySchema = z.enum([
  'salaried_private',
  'salaried_government',
  'self_employed_business',
  'self_employed_professional',
  'gig_worker',
  'farmer',
  'student',
  'homemaker',
  'retired',
  'other',
]);
export type OccupationCategory = z.infer<typeof occupationCategorySchema>;

/** Profile update payload — partial; only sent fields are changed. */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  photoCloudinaryId: z.string().optional(),
  city: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  occupationCategory: occupationCategorySchema.optional(),
  occupationDetail: z.string().trim().max(120).optional(),
  declaredMonthlyIncome: incomeBandSchema.optional(),
  // Lender-specific: max amount they're willing to lend out at any time.
  // Caps the total value of their open offers.
  monthlyLendingCapacityPaise: z
    .number()
    .int()
    .min(MIN_LOAN_AMOUNT_PAISE)
    .max(MAX_LOAN_AMOUNT_PAISE * 10) // up to 10x the per-loan cap
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Initial profile setup — city, occupation, and income band are required
 * before the user proceeds to KYC. Bio + lending capacity stay optional.
 *
 * Backend accepts the broader `updateProfileSchema` so subsequent edits can be
 * partial; the mobile signup flow uses this stricter schema for the first
 * submission.
 */
export const initialProfileSetupSchema = z.object({
  city: z.string().trim().min(2, 'Please enter your city').max(80),
  occupationCategory: occupationCategorySchema,
  occupationDetail: z.string().trim().max(120).optional(),
  declaredMonthlyIncome: incomeBandSchema,
  bio: z.string().trim().max(500).optional(),
  monthlyLendingCapacityPaise: z
    .number()
    .int()
    .min(MIN_LOAN_AMOUNT_PAISE)
    .max(MAX_LOAN_AMOUNT_PAISE * 10)
    .optional(),
});
export type InitialProfileSetupInput = z.infer<typeof initialProfileSetupSchema>;

/** Public profile shape returned by GET /v1/me/profile. */
export const meProfileSchema = z.object({
  userId: z.string(),
  name: z.string(),
  photoUrl: z.string().url().optional(),
  city: z.string().optional(),
  bio: z.string().optional(),
  occupationCategory: occupationCategorySchema.optional(),
  occupationDetail: z.string().optional(),
  declaredMonthlyIncome: incomeBandSchema.optional(),
  monthlyLendingCapacityPaise: z.number().int().optional(),
  isComplete: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type MeProfile = z.infer<typeof meProfileSchema>;
