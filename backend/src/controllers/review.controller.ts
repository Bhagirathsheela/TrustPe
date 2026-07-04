import type { Request, Response, NextFunction } from 'express';
import {
  reviewQuerySchema,
  submitReviewSchema,
  type ReviewQuery,
  type SubmitReviewInput,
} from 'trustpe-shared';
import { reviewService } from '../services/review.service.js';
import { ctxFromRequest } from '../utils/request-context.js';
import { AppError } from '../middleware/error-handler.js';

export const reviewController = {
  // POST /v1/loans/:loanId/reviews
  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { loanId } = req.params;
      if (!loanId) throw new AppError('missing_id', 'Loan id is required', 400);
      const body = (req.validated?.body ?? submitReviewSchema.parse(req.body)) as SubmitReviewInput;
      const review = await reviewService.submit(
        loanId,
        req.user.id,
        body,
        ctxFromRequest(req, 'user'),
      );
      res.status(201).json({ ok: true, data: review });
    } catch (err) {
      next(err);
    }
  },

  // GET /v1/loans/:loanId/reviews/mine — has the caller already reviewed this loan?
  async mineOnLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { loanId } = req.params;
      if (!loanId) throw new AppError('missing_id', 'Loan id is required', 400);
      const data = await reviewService.getByLoanForReviewer(loanId, req.user.id);
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  // GET /v1/users/:userId/reviews
  async forUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { userId } = req.params;
      if (!userId) throw new AppError('missing_id', 'User id is required', 400);
      const query = reviewQuerySchema.parse(req.query) as ReviewQuery;
      const data = await reviewService.listForReviewee(userId, query);
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },
};
