import type { Request, Response, NextFunction } from 'express';
import { kycSubmissionSchema, type KycSubmissionInput } from 'trustpe-shared';
import { kycService } from '../services/kyc.service.js';
import { ctxFromRequest } from '../utils/request-context.js';
import { AppError } from '../middleware/error-handler.js';

export const kycController = {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const record = await kycService.getMyKyc(req.user.id);
      res.json({ ok: true, data: record });
    } catch (err) {
      next(err);
    }
  },

  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const body = req.validated?.body as KycSubmissionInput;
      const record = await kycService.submit(req.user.id, body, ctxFromRequest(req, 'user'));
      res.status(201).json({ ok: true, data: record });
    } catch (err) {
      next(err);
    }
  },
};

export { kycSubmissionSchema };
