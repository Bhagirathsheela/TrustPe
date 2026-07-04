import { Router } from 'express';
import { requestUploadSignatureSchema } from 'trustpe-shared';
import { uploadsController } from '../controllers/uploads.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);

uploadsRouter.post(
  '/signature',
  validateBody(requestUploadSignatureSchema),
  uploadsController.signature,
);
