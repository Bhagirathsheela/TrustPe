import type { Request, Response, NextFunction } from 'express';
import type { RequestUploadSignatureInput } from 'trustpe-shared';
import { cloudinaryService } from '../services/cloudinary.service.js';
import { AppError } from '../middleware/error-handler.js';

export const uploadsController = {
  signature(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) throw new AppError('unauthorized', 'Not authenticated', 401);
      const body = req.validated?.body as RequestUploadSignatureInput;
      const sig = cloudinaryService.sign(body.folder);
      res.json({ ok: true, data: sig });
    } catch (err) {
      next(err);
    }
  },
};
