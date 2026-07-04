/**
 * Loan request routes.
 *
 * Mounted at /v1/loan-requests.
 *
 * Read-paths (search, getOne) require auth so we can filter out the caller's
 * own requests in browse, and so admin tools can later track who viewed which
 * request.
 */
import { Router } from 'express';
import {
  createLoanRequestSchema,
  fundRequestSchema,
  updateLoanRequestSchema,
} from 'trustpe-shared';
import { loanRequestController } from '../controllers/loan-request.controller.js';
import { loanOfferController } from '../controllers/loan-offer.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { idempotency } from '../middleware/idempotency.js';

export const loanRequestRouter = Router();

loanRequestRouter.use(requireAuth);

// Borrower side
loanRequestRouter.post('/', validateBody(createLoanRequestSchema), loanRequestController.create);
loanRequestRouter.get('/mine', loanRequestController.getMine);
loanRequestRouter.patch(
  '/:id',
  validateBody(updateLoanRequestSchema),
  loanRequestController.update,
);
loanRequestRouter.post('/:id/cancel', loanRequestController.cancel);

// Lender / shared
loanRequestRouter.get('/', loanRequestController.search);
loanRequestRouter.get('/:id', loanRequestController.getOne);

// Funding (was "offers") — lender taps Fund, backend creates Loan transactionally.
loanRequestRouter.post(
  '/:id/offers',
  idempotency,
  validateBody(fundRequestSchema),
  loanOfferController.fundOnRequest,
);
loanRequestRouter.get('/:id/offers', loanOfferController.listForRequest);
