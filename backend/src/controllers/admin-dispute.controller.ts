import type { Request, Response, NextFunction } from 'express';
import {
  disputeQueueQuerySchema,
  disputeResolutionSchema,
  type DisputeQueueQuery,
  type DisputeResolutionInput,
} from 'trustpe-shared';
import { adminDisputeService } from '../services/admin-dispute.service.js';
import { ctxFromRequest } from '../utils/request-context.js';
import { AppError } from '../middleware/error-handler.js';

export const adminDisputeController = {
  async listQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = disputeQueueQuerySchema.parse(req.query) as DisputeQueueQuery;
      const result = await adminDisputeService.listQueue(query);
      res.json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Intent id is required', 400);
      const data = await adminDisputeService.getOne(id);
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Intent id is required', 400);
      const body = (req.validated?.body ??
        disputeResolutionSchema.parse(req.body)) as DisputeResolutionInput;
      const data = await adminDisputeService.resolve(
        id,
        req.user.id,
        body,
        ctxFromRequest(req, 'admin'),
      );
      res.status(201).json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },
};
