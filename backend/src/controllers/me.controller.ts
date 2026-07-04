/**
 * "Me" controller — the authenticated user reading their own data.
 *
 * GET /v1/me returns the MeUser shape from shared schemas — everything the
 * signed-in user is allowed to see about themselves.
 */
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error-handler.js';
import { User } from '../models/User.js';
import { mePrivacyService } from '../services/me-privacy.service.js';

export const meController = {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const user = await User.findById(req.user.id);
      if (!user) throw new AppError('user_not_found', 'User no longer exists', 404);

      res.json({
        ok: true,
        data: {
          id: String(user._id),
          phone: user.phone,
          email: user.email,
          name: user.name,
          handle: user.handle,
          status: user.status,
          kycStatus: user.kycStatus,
          roles: user.roles,
          trustScore: user.trustScore,
          trustBand: user.trustBand,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /** DPDP §11 — return everything we hold about the caller. */
  async exportData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const data = await mePrivacyService.exportData(req.user.id);
      // Send as attachment so the user can save the JSON directly.
      const filename = `trustpe-export-${req.user.id}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(JSON.stringify(data, null, 2));
    } catch (err) {
      next(err);
    }
  },

  /** DPDP §12 — preview whether the caller can delete their account today. */
  async deletionPrecheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const data = await mePrivacyService.deletionPrecheck(req.user.id);
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** DPDP §12 — execute deletion. Best-effort — the mobile client should
   *  precheck first for a clean UX. */
  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
      const result = await mePrivacyService.deleteAccount(req.user.id, reason, {
        actorType: 'user',
        actorId: req.user.id,
        ip: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      });
      if (!result.ok) {
        // Deletion blocked — return 409 so the client can show the
        // blocking-loans message with the right severity.
        res.status(409).json({
          ok: false,
          error: {
            code: result.code,
            message:
              'You have live loans that must be settled before you can delete your account.',
            details: { blockingLoanCount: result.blockingLoanCount },
          },
        });
        return;
      }
      res.json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
