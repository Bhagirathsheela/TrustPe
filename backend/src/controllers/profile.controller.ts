/**
 * Profile controller — thin handlers for /v1/me/profile.
 */
import type { Request, Response, NextFunction } from 'express';
import { updateProfileSchema, type UpdateProfileInput } from 'trustpe-shared';
import { profileService } from '../services/profile.service.js';
import { ctxFromRequest } from '../utils/request-context.js';
import { AppError } from '../middleware/error-handler.js';

export const profileController = {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const profile = await profileService.getMyProfile(req.user.id);
      res.json({ ok: true, data: profile });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const body = req.validated?.body as UpdateProfileInput;
      const profile = await profileService.updateMyProfile(
        req.user.id,
        body,
        ctxFromRequest(req, 'user'),
      );
      res.json({ ok: true, data: profile });
    } catch (err) {
      next(err);
    }
  },
};

// Re-export the schema name so routes file doesn't need a separate import.
export { updateProfileSchema };
