/**
 * Root router — composes resource routers under their respective prefixes.
 */
import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { meRouter } from './me.routes.js';
import { uploadsRouter } from './uploads.routes.js';
import { adminRouter } from './admin.routes.js';
import { loanRequestRouter } from './loan-request.routes.js';
import { loanOfferRouter } from './loan-offer.routes.js';
import { loanRouter } from './loan.routes.js';
import { paymentRouter } from './payment.routes.js';
import { userProfileRouter } from './user-profile.routes.js';

export const router = Router();

router.use('/health', healthRouter);

const v1 = Router();
v1.use('/auth', authRouter);
v1.use('/me', meRouter);
v1.use('/uploads', uploadsRouter);
v1.use('/admin', adminRouter);
v1.use('/loan-requests', loanRequestRouter);
v1.use('/loan-offers', loanOfferRouter);
v1.use('/loans', loanRouter);
v1.use('/payments', paymentRouter);
v1.use('/users', userProfileRouter);
router.use('/v1', v1);
