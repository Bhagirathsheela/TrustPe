import { z } from 'zod';

/**
 * UPI VPA (Virtual Payment Address) syntax: handle@psp.
 * Allows letters, digits, .-_ in both halves.
 *
 * This is the single source of truth for VPA validation across mobile, admin,
 * and backend. KYC submission embeds this; future loan/payment flows reuse it.
 */
export const vpaSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{2,}@[a-z]{2,}$/, 'Enter a valid UPI ID (e.g., name@oksbi)')
  .max(100);

/**
 * Verification method enum — recorded on the KYC record so we know how each
 * user's VPA was approved.
 *
 * Phase 1: admin_manual (admin runs a free NPCI name-lookup in their own UPI app)
 * Phase 2 swap candidates: cashfree_penny_drop, reverse_penny_drop
 * Phase 2 alt: ocr_screenshot_auto if we add client OCR
 */
export const upiVerificationMethodSchema = z.enum([
  'ocr_screenshot_auto',
  'admin_manual',
  'reverse_penny_drop',
  'cashfree_penny_drop',
]);
export type UpiVerificationMethod = z.infer<typeof upiVerificationMethodSchema>;
