/**
 * Loan offer routes — single-offer reads under /v1/loan-offers.
 *
 * Funding (create) lives under /v1/loan-requests/:id/offers (see
 * loan-request.routes.ts) for resource-hierarchy clarity.
 */
import { Router } from 'express';
import { loanOfferController } from '../controllers/loan-offer.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const loanOfferRouter = Router();
loanOfferRouter.use(requireAuth);

loanOfferRouter.get('/mine', loanOfferController.listMine);
loanOfferRouter.get('/:id', loanOfferController.getOne);
