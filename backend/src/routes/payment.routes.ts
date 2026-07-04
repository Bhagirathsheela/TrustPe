/**
 * Payment routes — single-payment surface under /v1/payments.
 *
 * Initiation lives under /v1/loans/:loanId/... (see loan.routes.ts) for
 * resource-hierarchy clarity.
 */
import { Router } from 'express';
import {
  payerEvidenceSchema,
  payerFailureSchema,
  receiverAttestationSchema,
} from 'trustpe-shared';
import { paymentController } from '../controllers/payment.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { idempotency } from '../middleware/idempotency.js';

export const paymentRouter = Router();
paymentRouter.use(requireAuth);

paymentRouter.get('/:id', paymentController.getOne);
paymentRouter.post(
  '/:id/payer-evidence',
  idempotency,
  validateBody(payerEvidenceSchema),
  paymentController.payerEvidence,
);
paymentRouter.post(
  '/:id/payer-failure',
  idempotency,
  validateBody(payerFailureSchema),
  paymentController.payerFailure,
);
paymentRouter.post(
  '/:id/attestation',
  idempotency,
  validateBody(receiverAttestationSchema),
  paymentController.attestation,
);
