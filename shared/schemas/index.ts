/**
 * Zod schemas — the contract between backend and frontend.
 *
 * Each schema is the source of truth for a data shape that crosses an API boundary.
 * Backend uses these to parse `req.body`/`req.query`. Frontend (mobile + admin) uses
 * these as React Hook Form resolvers.
 *
 * `.js` extensions are required by NodeNext module resolution (backend's
 * production build). Metro and TypeScript Bundler resolution both accept
 * them fine.
 */
export * from './admin.js';
export * from './agreement.js';
export * from './auth.js';
export * from './chat.js';
export * from './common.js';
export * from './dispute.js';
export * from './kyc.js';
export * from './loan.js';
export * from './loan-offer.js';
export * from './loan-request.js';
export * from './notification.js';
export * from './payment.js';
export * from './profile.js';
export * from './review.js';
export * from './upi.js';
export * from './uploads.js';
export * from './user.js';
