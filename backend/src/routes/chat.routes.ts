/**
 * Chat routes — message history + send.
 *
 * Mounted at /v1/loans/:loanId/messages.
 */
import { Router } from 'express';
import { sendMessageSchema } from 'trustpe-shared';
import { chatController } from '../controllers/chat.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

// `mergeParams` lets us read :loanId from the parent router (loans/:loanId/...).
export const chatRouter = Router({ mergeParams: true });
chatRouter.use(requireAuth);

chatRouter.get('/', chatController.list);
chatRouter.post('/', validateBody(sendMessageSchema), chatController.send);
