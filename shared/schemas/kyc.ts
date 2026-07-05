import { z } from 'zod';
import { vpaSchema } from './upi.js';

/** Indian PAN — 5 letters, 4 digits, 1 letter. */
export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN (e.g., ABCDE1234F)');

/**
 * KYC submission — the single onboarding step that captures identity AND
 * payment setup in one pass.
 *
 * We do NOT collect the Aadhaar number (Aadhaar Act §29 forbids non-KUA
 * entities from storing it). The full number is visible on the uploaded
 * image; admin verifies via UIDAI's public portal during review.
 *
 * Payment binding is the user's UPI ID (VPA). We do NOT collect bank
 * account + IFSC because:
 *   - We never move money through the platform (P2P direct UPI)
 *   - UPI Intent (the deep-link used for disbursement / EMI in Sprint 3)
 *     only accepts a VPA in `pa=`; bank account isn't a UPI Intent target
 *   - The agreement PDF is enforceable with identity + VPA + IP/device hash
 *
 * VPA verification is admin_manual in Phase 1: the admin pastes the
 * submitted VPA into their own UPI app's "Send money" screen, NPCI returns
 * the registered holder name, admin compares with the user's KYC name, and
 * cancels the transfer. Zero cost, ~20 seconds per user. Phase 2 swaps to
 * Cashfree penny drop without touching this schema.
 */
export const kycSubmissionSchema = z.object({
  pan: panSchema,
  aadhaarFrontCloudinaryId: z.string().min(1, 'Upload the front side of your Aadhaar'),
  aadhaarBackCloudinaryId: z.string().min(1, 'Upload the back side of your Aadhaar'),
  panFrontCloudinaryId: z.string().min(1, 'Upload the front side of your PAN card'),
  selfieVideoCloudinaryId: z.string().min(1, 'Record the selfie video'),
  // Primary UPI ID — used for disbursement and EMI deep-links in Sprint 3.
  vpa: vpaSchema,
});
export type KycSubmissionInput = z.infer<typeof kycSubmissionSchema>;

/** Admin KYC decision payload. */
export const kycDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject', 'request_clarification']),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.decision === 'approve' || (d.reason && d.reason.length > 0), {
    message: 'A reason is required when rejecting or requesting clarification',
    path: ['reason'],
  });
export type KycDecisionInput = z.infer<typeof kycDecisionSchema>;

/** Admin KYC queue query filters. */
export const kycQueueQuerySchema = z.object({
  status: z
    .enum(['submitted', 'approved', 'rejected', 'needs_clarification'])
    .optional()
    .default('submitted'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});
export type KycQueueQuery = z.infer<typeof kycQueueQuerySchema>;
