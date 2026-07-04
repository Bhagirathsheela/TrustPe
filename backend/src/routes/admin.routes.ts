/**
 * Admin routes — all admin-only endpoints live under /v1/admin.
 *
 * Every route here is gated by `requireAuth` then `requireRoles('super_admin',
 * 'admin', 'compliance')`. Compliance can review KYC; only super_admin/admin
 * can reverse decisions in later sprints.
 */
import { Router } from 'express';
import { disputeResolutionSchema, kycDecisionSchema } from 'trustpe-shared';
import { adminKycController } from '../controllers/admin-kyc.controller.js';
import { adminDisputeController } from '../controllers/admin-dispute.controller.js';
import { adminUserController } from '../controllers/admin-user.controller.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireRoles('super_admin', 'admin', 'compliance'));

// KYC review queue — also the UPI verification gate, since VPA is bound
// inside the KYC submission and admin verifies via free NPCI name-lookup
// in their own UPI app. See docs/ONBOARDING_FLOW.md.
adminRouter.get('/kyc/queue', adminKycController.listQueue);
adminRouter.get('/kyc/:id', adminKycController.getOne);
adminRouter.post(
  '/kyc/:id/decision',
  validateBody(kycDecisionSchema),
  adminKycController.decide,
);

// Payment dispute queue
adminRouter.get('/disputes/queue', adminDisputeController.listQueue);
adminRouter.get('/disputes/:id', adminDisputeController.getOne);
adminRouter.post(
  '/disputes/:id/resolve',
  validateBody(disputeResolutionSchema),
  adminDisputeController.resolve,
);

// User directory + per-user detail (read-only views into pilot members)
adminRouter.get('/users', adminUserController.list);
adminRouter.get('/users/:id', adminUserController.detail);

// Audit-log viewer — filter by actor / entity / action / date range
adminRouter.get('/audit-logs', adminUserController.auditLog);
