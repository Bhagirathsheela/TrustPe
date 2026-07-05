import { z } from 'zod';
import { MAX_LOAN_TENURE_MONTHS } from '../constants/index.js';

/**
 * Payment intent kinds.
 *   disbursal  — lender → borrower; first payment after agreement signing
 *   emi        — borrower → lender; one per scheduled EMI installment
 *   preclose   — borrower → lender; voluntary full settlement before tenure ends
 */
export const paymentIntentKindSchema = z.enum(['disbursal', 'emi', 'preclose']);
export type PaymentIntentKind = z.infer<typeof paymentIntentKindSchema>;

/**
 * Payment intent state machine.
 *
 *   awaiting_payer_evidence  — intent created; waiting for payer to fire UPI and mark
 *   payer_confirmed          — payer has marked the payment (with optional UTR)
 *   verified                 — receiver attested receipt; payment is final
 *   failed                   — payer marked the payment as failed in their UPI app
 *   expired                  — auto-expired after N days without resolution (Phase 2 — cron-driven)
 *   disputed                 — receiver said they didn't receive after payer confirmed (admin review)
 */
export const paymentIntentStatusSchema = z.enum([
  'awaiting_payer_evidence',
  'payer_confirmed',
  'verified',
  'failed',
  'expired',
  'disputed',
]);
export type PaymentIntentStatus = z.infer<typeof paymentIntentStatusSchema>;

/** Payer's evidence after launching their UPI app. */
export const payerEvidenceSchema = z.object({
  /** 12-digit UPI transaction reference; optional in Phase 1 but recommended. */
  utr: z.string().trim().regex(/^\d{12}$/, 'UTR must be 12 digits').optional(),
  /** Confirmation that the displayed amount in the UPI app matched. */
  amountConfirmed: z.boolean(),
  /** Free-form note from the payer (e.g. "GPay return code 00"). */
  note: z.string().trim().max(500).optional(),
});
export type PayerEvidenceInput = z.infer<typeof payerEvidenceSchema>;

/** Payer can also mark the payment as failed if the UPI app reported failure. */
export const payerFailureSchema = z.object({
  reason: z.string().trim().max(500),
});
export type PayerFailureInput = z.infer<typeof payerFailureSchema>;

/** Receiver attestation — closes the payment loop. */
export const receiverAttestationSchema = z.object({
  decision: z.enum(['received', 'not_received']),
  reason: z.string().trim().max(500).optional(),
});
export type ReceiverAttestationInput = z.infer<typeof receiverAttestationSchema>;

/** Disbursal initiation — no input from lender beyond their intent to disburse. */
export const initiateDisbursalSchema = z.object({});
export type InitiateDisbursalInput = z.infer<typeof initiateDisbursalSchema>;

/** EMI payment initiation — borrower nominates which EMI installment they're paying. */
export const initiateEmiPaymentSchema = z.object({
  emiNumber: z.number().int().min(1).max(MAX_LOAN_TENURE_MONTHS),
});
export type InitiateEmiPaymentInput = z.infer<typeof initiateEmiPaymentSchema>;
