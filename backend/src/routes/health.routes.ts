import { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';

export const healthRouter = Router();

healthRouter.get('/', healthController.check);
healthRouter.get('/ready', healthController.ready);
