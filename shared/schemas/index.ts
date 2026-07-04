/**
 * Zod schemas — the contract between backend and frontend.
 *
 * Each schema is the source of truth for a data shape that crosses an API boundary.
 * Backend uses these to parse `req.body`/`req.query`. Frontend (mobile + admin) uses
 * these as React Hook Form resolvers.
 */
export * from './admin';
export * from './agreement';
export * from './auth';
export * from './chat';
export * from './common';
export * from './dispute';
export * from './kyc';
export * from './loan';
export * from './loan-offer';
export * from './loan-request';
export * from './notification';
export * from './payment';
export * from './profile';
export * from './review';
export * from './upi';
export * from './uploads';
export * from './user';
