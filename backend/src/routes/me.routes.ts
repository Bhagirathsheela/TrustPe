import { Router } from 'express';
import {
  kycSubmissionSchema,
  registerPushTokenSchema,
  updateNotificationPreferencesSchema,
  updateProfileSchema,
} from 'trustpe-shared';
import { meController } from '../controllers/me.controller.js';
import { profileController } from '../controllers/profile.controller.js';
import { kycController } from '../controllers/kyc.controller.js';
import { notificationController } from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export const meRouter = Router();

// All /me endpoints require auth.
meRouter.use(requireAuth);

meRouter.get('/', meController.get);

meRouter.get('/profile', profileController.get);
meRouter.patch('/profile', validateBody(updateProfileSchema), profileController.update);

meRouter.get('/kyc', kycController.get);
meRouter.post('/kyc', validateBody(kycSubmissionSchema), kycController.submit);

// Notifications + push tokens
meRouter.get('/notifications', notificationController.list);
meRouter.post('/notifications/:id/read', notificationController.markRead);
meRouter.post('/notifications/read-all', notificationController.markAllRead);
meRouter.post(
  '/push-tokens',
  validateBody(registerPushTokenSchema),
  notificationController.registerPushToken,
);
meRouter.post('/push-tokens/remove', notificationController.unregisterPushToken);

// DPDP Act §11–14 — data export + account deletion
meRouter.get('/export', meController.exportData);
meRouter.get('/deletion-precheck', meController.deletionPrecheck);
meRouter.post('/delete-account', meController.deleteAccount);

meRouter.get('/notification-preferences', notificationController.getPreferences);
meRouter.patch(
  '/notification-preferences',
  validateBody(updateNotificationPreferencesSchema),
  notificationController.updatePreferences,
);
