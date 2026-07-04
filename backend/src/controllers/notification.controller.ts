import type { Request, Response, NextFunction } from 'express';
import {
  notificationQuerySchema,
  registerPushTokenSchema,
  updateNotificationPreferencesSchema,
  type NotificationQuery,
  type RegisterPushTokenInput,
  type UpdateNotificationPreferencesInput,
} from 'trustpe-shared';
import { notificationService } from '../services/notification.service.js';
import { AppError } from '../middleware/error-handler.js';

export const notificationController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const query = notificationQuerySchema.parse(req.query) as NotificationQuery;
      const data = await notificationService.list(req.user.id, query);
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const { id } = req.params;
      if (!id) throw new AppError('missing_id', 'Notification id is required', 400);
      const data = await notificationService.markRead(req.user.id, id);
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const data = await notificationService.markAllRead(req.user.id);
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  async registerPushToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const body = (req.validated?.body ??
        registerPushTokenSchema.parse(req.body)) as RegisterPushTokenInput;
      await notificationService.registerToken(req.user.id, body.token, body.platform);
      res.status(201).json({ ok: true, data: null });
    } catch (err) {
      next(err);
    }
  },

  async unregisterPushToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const token = req.body?.token as string | undefined;
      if (!token) throw new AppError('missing_token', 'Token is required', 400);
      await notificationService.unregisterToken(token);
      res.json({ ok: true, data: null });
    } catch (err) {
      next(err);
    }
  },

  async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const data = await notificationService.getPreferences(req.user.id);
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const body = (req.validated?.body ??
        updateNotificationPreferencesSchema.parse(req.body)) as UpdateNotificationPreferencesInput;
      const data = await notificationService.updatePreferences(
        req.user.id,
        body.mutedCategories ?? [],
      );
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },
};
