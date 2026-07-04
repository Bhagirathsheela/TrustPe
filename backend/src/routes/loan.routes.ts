import { Router } from 'express';
import {
  initiateEmiPaymentSchema,
  signAgreementSchema,
  submitReviewSchema,
} from 'trustpe-shared';
import { loanController } from '../controllers/loan.controller.js';
import { agreementController } from '../controllers/agreement.controller.js';
import { paymentController } from '../controllers/payment.controller.js';
import { emiController } from '../controllers/emi.controller.js';
import { reviewController } from '../controllers/review.controller.js';
import { chatRouter } from './chat.routes.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { idempotency } from '../middleware/idempotency.js';

export const loanRouter = Router();
loanRouter.use(requireAuth);

loanRouter.get('/mine', loanController.getMine);
loanRouter.get('/:id', loanController.getOne);

// Chat thread nested under each loan: /v1/loans/:loanId/messages
loanRouter.use('/:loanId/messages', chatRouter);

// Agreement nested under each loan: /v1/loans/:loanId/agreement
loanRouter.get('/:loanId/agreement', agreementController.get);
loanRouter.post(
  '/:loanId/agreement/sign',
  validateBody(signAgreementSchema),
  agreementController.sign,
);

// Payment initiation nested under each loan.
// `idempotency` honours the Idempotency-Key header (optional during rollout).
loanRouter.post('/:loanId/disburse', idempotency, paymentController.disburse);
loanRouter.post(
  '/:loanId/emi-payments',
  idempotency,
  validateBody(initiateEmiPaymentSchema),
  paymentController.initiateEmi,
);
loanRouter.get('/:loanId/payments', paymentController.listForLoan);
loanRouter.get('/:loanId/emis', emiController.getForLoan);

// Reviews nested under each loan
loanRouter.post(
  '/:loanId/reviews',
  validateBody(submitReviewSchema),
  reviewController.submit,
);
loanRouter.get('/:loanId/reviews/mine', reviewController.mineOnLoan);
