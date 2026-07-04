import type { Request, Response, NextFunction } from 'express';
import { myLoansQuerySchema, type MyLoansQuery } from 'trustpe-shared';
import { loanService } from '../services/loan.service.js';
import { AppError } from '../middleware/error-handler.js';

export const loanController = {
  async getMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const query = myLoansQuerySchema.parse(req.query) as MyLoansQuery;
      const items = await loanService.getMine(req.user.id, query);
      res.json({ ok: true, data: { items } });
    } catch (err) {
      next(err);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Loan id is required', 400);
      const loan = await loanService.getOne(id, req.user.id);
      res.json({ ok: true, data: loan });
    } catch (err) {
      next(err);
    }
  },
};
