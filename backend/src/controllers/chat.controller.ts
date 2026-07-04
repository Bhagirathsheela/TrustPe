import type { Request, Response, NextFunction } from 'express';
import {
  messageQuerySchema,
  sendMessageSchema,
  type MessageQuery,
  type SendMessageInput,
} from 'trustpe-shared';
import { chatService } from '../services/chat.service.js';
import { AppError } from '../middleware/error-handler.js';

export const chatController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { loanId } = req.params;
      if (!loanId) throw new AppError('missing_id', 'Loan id is required', 400);
      const query = messageQuerySchema.parse(req.query) as MessageQuery;
      const items = await chatService.list(loanId, req.user.id, query);
      res.json({ ok: true, data: { items } });
    } catch (err) {
      next(err);
    }
  },

  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { loanId } = req.params;
      if (!loanId) throw new AppError('missing_id', 'Loan id is required', 400);
      const body = (req.validated?.body ?? sendMessageSchema.parse(req.body)) as SendMessageInput;
      const message = await chatService.send(loanId, req.user.id, body);
      res.status(201).json({ ok: true, data: message });
    } catch (err) {
      next(err);
    }
  },
};
