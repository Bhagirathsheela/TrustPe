import { z } from 'zod';

/** Lifecycle status of a user account. */
export const userStatusSchema = z.enum([
  'unverified', // Just signed up, OTP not yet verified
  'onboarding', // OTP verified, completing profile / KYC / UPI
  'pending_review', // KYC submitted, awaiting admin
  'active', // Fully approved
  'suspended', // Admin-suspended
]);
export type UserStatus = z.infer<typeof userStatusSchema>;

/** KYC review state. */
export const kycStatusSchema = z.enum([
  'not_started',
  'submitted',
  'approved',
  'rejected',
  'needs_clarification',
]);
export type KycStatus = z.infer<typeof kycStatusSchema>;

/** Admin role hierarchy. Phase 1 has only super_admin; rest reserved for Phase 2. */
export const userRoleSchema = z.enum([
  'user',
  'super_admin',
  'admin',
  'support',
  'compliance',
  'finance',
]);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Public-facing user shape (no PII beyond what's intentionally public). */
export const publicUserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  photoUrl: z.string().url().optional(),
  city: z.string().optional(),
  trustScore: z.number().int().min(300).max(900),
  trustBand: z.enum(['building', 'fair', 'good', 'very_good', 'excellent']),
  completedLoansCount: z.number().int().min(0),
  memberSinceMonths: z.number().int().min(0),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

/** Private "me" shape — what the authenticated user sees about themselves. */
export const meUserSchema = publicUserSchema.extend({
  phone: z.string(),
  email: z.string(),
  status: userStatusSchema,
  kycStatus: kycStatusSchema,
  roles: z.array(userRoleSchema),
});
export type MeUser = z.infer<typeof meUserSchema>;
