import { Router } from 'express';
import { signupSchema, verifyOtpSchema, loginSchema, refreshSchema } from 'trustpe-shared';
import { authController } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import {
  authTokenLimiter,
  otpRequestIpLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
} from '../middleware/rate-limit.js';

export const authRouter = Router();

// Rate limiters run BEFORE validation so abuse never reaches the OTP/email
// pipeline. Limits: 5 codes / email / 15 min, 20 codes / IP / 15 min,
// 10 verify attempts / IP / 15 min.
authRouter.post(
  '/signup',
  otpRequestIpLimiter,
  otpRequestLimiter,
  validateBody(signupSchema),
  authController.signup,
);
authRouter.post(
  '/login',
  otpRequestIpLimiter,
  otpRequestLimiter,
  validateBody(loginSchema),
  authController.login,
);
authRouter.post('/verify-otp', otpVerifyLimiter, validateBody(verifyOtpSchema), authController.verifyOtp);
authRouter.post('/refresh', authTokenLimiter, validateBody(refreshSchema), authController.refresh);
authRouter.post('/logout', authTokenLimiter, validateBody(refreshSchema), authController.logout);
