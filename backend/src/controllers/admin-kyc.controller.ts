/**
 * Admin KYC controller — thin. Parses input → calls one service method →
 * formats the success/error envelope. See CLAUDE.md "Controller / service /
 * model split".
 */
import type { Request, Response, NextFunction } from 'express';
import {
  kycDecisionSchema,
  kycQueueQuerySchema,
  type KycDecisionInput,
  type KycQueueQuery,
} from 'trustpe-shared';
import { adminKycService } from '../services/admin-kyc.service.js';
import { ctxFromRequest } from '../utils/request-context.js';
import { AppError } from '../middleware/error-handler.js';

export const adminKycController = {
  async listQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = kycQueueQuerySchema.parse(req.query) as KycQueueQuery;
      const result = await adminKycService.listQueue(query);
      res.json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'KYC id is required', 400);
      const record = await adminKycService.getOne(id);
      res.json({ ok: true, data: record });
    } catch (err) {
      next(err);
    }
  },

  async decide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'KYC id is required', 400);
      const body = (req.validated?.body ?? kycDecisionSchema.parse(req.body)) as KycDecisionInput;
      const record = await adminKycService.decide(
        id,
        req.user.id,
        body,
        ctxFromRequest(req, 'admin'),
      );
      res.json({ ok: true, data: record });
    } catch (err) {
      next(err);
    }
  },
};
