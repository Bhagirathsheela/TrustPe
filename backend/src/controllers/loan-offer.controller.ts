/**
 * Loan-offer controller — thin. Parses input → calls service → formats envelope.
 *
 * Fixed-rate flow:
 *   POST /v1/loan-requests/:id/offers  → fund the request (see loan-request.routes.ts)
 *   GET  /v1/loan-requests/:id/offers  → list offers on a request (borrower-only)
 *   GET  /v1/loan-offers/mine          → my offers (flat)
 *   GET  /v1/loan-offers/:id           → offer detail
 */
import type { Request, Response, NextFunction } from 'express';
import { fundRequestSchema, type FundRequestInput } from 'trustpe-shared';
import { loanOfferService } from '../services/loan-offer.service.js';
import { ctxFromRequest } from '../utils/request-context.js';
import { AppError } from '../middleware/error-handler.js';

export const loanOfferController = {
  // Mounted at /v1/loan-requests/:id/offers — fund the request
  async fundOnRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const requestId = req.params.id;
      if (!requestId) throw new AppError('missing_id', 'Request id is required', 400);
      const body = (req.validated?.body ?? fundRequestSchema.parse(req.body ?? {})) as FundRequestInput;
      const result = await loanOfferService.fund(
        req.user.id,
        requestId,
        body,
        ctxFromRequest(req, 'user'),
      );
      res.status(201).json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async listForRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const requestId = req.params.id;
      if (!requestId) throw new AppError('missing_id', 'Request id is required', 400);
      const items = await loanOfferService.listForRequest(requestId, req.user.id);
      res.json({ ok: true, data: { items } });
    } catch (err) {
      next(err);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Offer id is required', 400);
      const offer = await loanOfferService.getOne(id, req.user.id);
      res.json({ ok: true, data: offer });
    } catch (err) {
      next(err);
    }
  },

  async listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const role = (req.query.role as 'lender' | 'borrower' | 'either' | undefined) ?? 'either';
      const items = await loanOfferService.listMine(req.user.id, role);
      res.json({ ok: true, data: { items } });
    } catch (err) {
      next(err);
    }
  },
};
