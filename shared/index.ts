/**
 * trustpe-shared — zod schemas, TypeScript types, and constants shared
 * between the backend, mobile app, and admin panel.
 *
 * Imported via path alias `@shared/*` from each app's tsconfig.
 *
 * Extensions on relative imports are required by NodeNext module
 * resolution (used by the backend `tsc` build). Metro and TypeScript's
 * Bundler resolution both handle `.js` pointing at `.ts` fine.
 *
 * See CLAUDE.md and docs/ARCHITECTURE.md for conventions.
 */
export * from './schemas/index.js';
export * from './types/index.js';
export * from './constants/index.js';
