import { z } from 'zod';

/**
 * Message kinds.
 *
 *   text                  — user-typed message
 *   system_disbursal      — Sprint 3: lender disbursed
 *   system_payment_marked — Sprint 3: borrower marked payment
 *   system_payment_attested — Sprint 3: lender attested receipt
 *   system_loan_signed    — Sprint 2D: both signed agreement
 *   system_loan_closed    — Sprint 4: final EMI confirmed
 *
 * Sprint 2C only emits `text`; other kinds are reserved for upcoming
 * sprints so the model + UI can render them without migration when they
 * start firing.
 */
export const messageKindSchema = z.enum([
  'text',
  'system_disbursal',
  'system_payment_marked',
  'system_payment_attested',
  'system_loan_signed',
  'system_loan_closed',
]);
export type MessageKind = z.infer<typeof messageKindSchema>;

/** Send a text message into a loan thread. */
export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(2000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const messageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  /** Cursor is the createdAt timestamp of the oldest message you have. */
  before: z.coerce.date().optional(),
});
export type MessageQuery = z.infer<typeof messageQuerySchema>;
