/**
 * Loan-request controller — thin. Parses input → calls service → formats envelope.
 */
import type { Request, Response, NextFunction } from 'express';
import {
  loanRequestQuerySchema,
  type CreateLoanRequestInput,
  type LoanRequestQuery,
  type UpdateLoanRequestInput,
} from 'trustpe-shared';
import { z } from 'zod';
import { loanRequestService } from '../services/loan-request.service.js';
import { ctxFromRequest } from '../utils/request-context.js';
import { AppError } from '../middleware/error-handler.js';

const cancelBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const loanRequestController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const body = req.validated?.body as CreateLoanRequestInput;
      const record = await loanRequestService.create(
        req.user.id,
        body,
        ctxFromRequest(req, 'user'),
      );
      res.status(201).json({ ok: true, data: record });
    } catch (err) {
      next(err);
    }
  },

  async getMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const records = await loanRequestService.getMine(req.user.id);
      res.json({ ok: true, data: { items: records } });
    } catch (err) {
      next(err);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Loan request id is required', 400);
      const record = await loanRequestService.getOne(id);
      res.json({ ok: true, data: record });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Loan request id is required', 400);
      const body = req.validated?.body as UpdateLoanRequestInput;
      const record = await loanRequestService.update(
        id,
        req.user.id,
        body,
        ctxFromRequest(req, 'user'),
      );
      res.json({ ok: true, data: record });
    } catch (err) {
      next(err);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Loan request id is required', 400);
      const body = cancelBodySchema.parse(req.body ?? {});
      const record = await loanRequestService.cancel(
        id,
        req.user.id,
        body.reason,
        ctxFromRequest(req, 'user'),
      );
      res.json({ ok: true, data: record });
    } catch (err) {
      next(err);
    }
  },

  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const query = loanRequestQuerySchema.parse(req.query) as LoanRequestQuery;
      const result = await loanRequestService.search(req.user.id, query);
      res.json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
