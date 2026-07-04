/**
 * Public user profile routes.
 *
 * Mounted at /v1/users.
 */
import { Router } from 'express';
import { userProfileController } from '../controllers/user-profile.controller.js';
import { reviewController } from '../controllers/review.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const userProfileRouter = Router();
userProfileRouter.use(requireAuth);

userProfileRouter.get('/:userId/profile', userProfileController.get);
userProfileRouter.get('/:userId/reviews', reviewController.forUser);
