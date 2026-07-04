import type { Request, Response, NextFunction } from 'express';
import { signAgreementSchema, type SignAgreementInput } from 'trustpe-shared';
import { agreementService } from '../services/agreement.service.js';
import { ctxFromRequest } from '../utils/request-context.js';
import { AppError } from '../middleware/error-handler.js';

export const agreementController = {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { loanId } = req.params;
      if (!loanId) throw new AppError('missing_id', 'Loan id is required', 400);
      const data = await agreementService.getForLoan(loanId, req.user.id);
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  async sign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { loanId } = req.params;
      if (!loanId) throw new AppError('missing_id', 'Loan id is required', 400);
      const body = (req.validated?.body ??
        signAgreementSchema.parse(req.body ?? {})) as SignAgreementInput;
      const data = await agreementService.sign(
        loanId,
        req.user.id,
        body,
        ctxFromRequest(req, 'user'),
      );
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },
};
