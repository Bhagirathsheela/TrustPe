import { z } from 'zod';

/**
 * Indian mobile number — exactly 10 digits starting with 6, 7, 8, or 9
 * (TRAI allocates only those prefixes to Indian mobile operators).
 *
 * The UI shows '+91' as a fixed visual prefix and only accepts 10 digits.
 * The schema accepts the bare 10 digits and transforms to E.164 (+91xxxxxxxxxx)
 * server-side for storage.
 *
 * If the user pastes a string with +91 / 91 prefix, the schema strips it
 * before validating (forgiving on paste, strict on submit).
 */
export const indianPhoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/\D/g, '').slice(-10))
  .pipe(
    z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile (starts with 6, 7, 8, or 9)'),
  )
  .transform((digits) => `+91${digits}`);

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name is too long')
  .regex(/^[a-zA-Z][a-zA-Z\s.''-]*$/, 'Name can only contain letters, spaces, and . - ' + "'");

/**
 * POST /v1/auth/signup
 * First-time signup. Creates a new user in 'unverified' status and triggers
 * an OTP email to the supplied address.
 */
export const signupSchema = z.object({
  phone: indianPhoneSchema,
  email: emailSchema,
  name: nameSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

/**
 * POST /v1/auth/verify-otp
 * Verifies the 6-digit OTP sent via email. On success, returns access + refresh tokens.
 */
export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/**
 * POST /v1/auth/login
 * Returning user — sends a fresh OTP to their registered email.
 */
export const loginSchema = z.object({
  email: emailSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * POST /v1/auth/refresh
 * Exchanges a refresh token for a fresh access token.
 * Refresh token is sent via httpOnly cookie (admin web) or request body (RN app).
 */
export const refreshSchema = z.object({
  refreshToken: z.string().min(32).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

/**
 * Response shape for successful auth (signup verified, refresh, login verified).
 */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessExpiresAt: z.string(),
  user: z.object({
    id: z.string(),
    phone: z.string(),
    email: z.string(),
    name: z.string(),
    handle: z.string().optional(),
    status: z.enum(['unverified', 'onboarding', 'pending_review', 'active', 'suspended']),
    kycStatus: z.enum(['not_started', 'submitted', 'approved', 'rejected', 'needs_clarification']),
  }),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;
