import type { Request, Response, NextFunction } from 'express';
import { emiService } from '../services/emi.service.js';
import { AppError } from '../middleware/error-handler.js';

export const emiController = {
  // GET /v1/loans/:loanId/emis
  async getForLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { loanId } = req.params;
      if (!loanId) throw new AppError('missing_id', 'Loan id is required', 400);
      const data = await emiService.getForLoan(loanId, req.user.id);
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },
};
