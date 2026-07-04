import { z } from 'zod';

/**
 * Notification kinds. Each kind drives copy, icon, and deep-link target.
 *
 * Loan flow:
 *   offer_funded         — borrower's request was funded
 *   agreement_pending    — other party signed; you should sign
 *   agreement_signed     — both signed; loan can proceed
 *   disbursal_initiated  — lender started disbursal (borrower-facing)
 *   payment_sent         — payer marked sent (receiver-facing)
 *   attest_needed        — your attestation is required (receiver-facing)
 *   payment_verified     — receiver attested received (payer-facing)
 *   loan_active          — loan went active after disbursal
 *   emi_due              — EMI due soon
 *   emi_overdue          — EMI past due date
 *   loan_closed          — final EMI verified, loan complete
 *
 * Trust + community:
 *   review_received      — someone left a review on you
 *   dispute_opened       — admin alert: a payment was disputed (admin-facing)
 *   dispute_resolved     — your dispute was resolved by admin
 *   loan_defaulted       — admin defaulted a loan you're on
 *
 * KYC:
 *   kyc_approved         — admin approved
 *   kyc_rejected         — admin rejected
 *   kyc_clarification    — admin requested clarification
 */
export const notificationKindSchema = z.enum([
  'offer_funded',
  'agreement_pending',
  'agreement_signed',
  'disbursal_initiated',
  'payment_sent',
  'attest_needed',
  'payment_verified',
  'loan_active',
  'emi_due',
  'emi_overdue',
  'loan_closed',
  'review_received',
  'dispute_opened',
  'dispute_resolved',
  'loan_defaulted',
  'kyc_approved',
  'kyc_rejected',
  'kyc_clarification',
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

/** Push token registration from mobile. */
export const registerPushTokenSchema = z.object({
  token: z.string().min(1, 'Push token is required'),
  platform: z.enum(['android', 'ios']),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

export const notificationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  before: z.string().optional(),
  unreadOnly: z.coerce.boolean().optional().default(false),
});
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;

/**
 * Categories the UI groups notification kinds into. Lets users mute by
 * theme rather than ticking 18 individual toggles.
 */
export const notificationCategorySchema = z.enum([
  'loan_activity',
  'payments',
  'emi_reminders',
  'reviews',
  'kyc',
  'disputes',
]);
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;

/** Map each kind to a category for grouped UI controls. */
export const NOTIFICATION_KIND_TO_CATEGORY: Record<NotificationKind, NotificationCategory> = {
  offer_funded: 'loan_activity',
  agreement_pending: 'loan_activity',
  agreement_signed: 'loan_activity',
  loan_active: 'loan_activity',
  loan_closed: 'loan_activity',
  disbursal_initiated: 'payments',
  payment_sent: 'payments',
  attest_needed: 'payments',
  payment_verified: 'payments',
  emi_due: 'emi_reminders',
  emi_overdue: 'emi_reminders',
  review_received: 'reviews',
  dispute_opened: 'disputes',
  dispute_resolved: 'disputes',
  loan_defaulted: 'disputes',
  kyc_approved: 'kyc',
  kyc_rejected: 'kyc',
  kyc_clarification: 'kyc',
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  loan_activity: 'Loan activity',
  payments: 'Payments',
  emi_reminders: 'EMI reminders',
  reviews: 'Reviews & TrustScore',
  kyc: 'KYC updates',
  disputes: 'Disputes & alerts',
};

export const NOTIFICATION_CATEGORY_HINTS: Record<NotificationCategory, string> = {
  loan_activity: 'Funding, agreement, loan-active, loan-closed',
  payments: 'Disbursal, payment marked sent, confirmation needed',
  emi_reminders: 'Upcoming and overdue EMI nudges',
  reviews: 'When someone leaves you a review',
  kyc: 'KYC approval / clarification / rejection',
  disputes: 'Dispute opened / resolved / loan defaulted',
};

export const updateNotificationPreferencesSchema = z.object({
  mutedCategories: z.array(notificationCategorySchema).optional(),
});
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;
