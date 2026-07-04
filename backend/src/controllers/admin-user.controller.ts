/**
 * Admin user controller — thin wrapper around adminUserService.
 *
 * Parses query/params from the request, delegates to the service, formats
 * the response. No business logic, no DB calls.
 */
import type { Request, Response, NextFunction } from 'express';
import { adminUserService } from '../services/admin-user.service.js';
import { AppError } from '../middleware/error-handler.js';

export const adminUserController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminUserService.list({
        q: (req.query.q as string | undefined) ?? undefined,
        status: (req.query.status as string | undefined) ?? undefined,
        kycStatus: (req.query.kycStatus as string | undefined) ?? undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
      });
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('invalid_id', 'User id is required', 400);
      const data = await adminUserService.detail(id);
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  async auditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminUserService.auditLog({
        actorId: (req.query.actorId as string | undefined) ?? undefined,
        entityType: (req.query.entityType as string | undefined) ?? undefined,
        entityId: (req.query.entityId as string | undefined) ?? undefined,
        action: (req.query.action as string | undefined) ?? undefined,
        from: (req.query.from as string | undefined) ?? undefined,
        to: (req.query.to as string | undefined) ?? undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
      });
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },
};
