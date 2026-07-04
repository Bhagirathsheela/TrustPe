/**
 * Admin schemas are defined in `./kyc.ts` to keep KYC-related types together:
 *   - kycDecisionSchema / KycDecisionInput  → POST /v1/admin/kyc/:id/decision
 *   - kycQueueQuerySchema / KycQueueQuery   → GET  /v1/admin/kyc/queue
 *
 * The backend's `admin-kyc.service.ts` defines its own response shapes
 * (`AdminKycListItem`, `AdminKycDetail`). The admin Next.js mirrors those
 * shapes in `admin/src/lib/types.ts` so shared doesn't carry admin-only DTOs.
 *
 * This file is kept as an explicit placeholder so the routing / import map
 * stays discoverable when looking up admin-related schemas.
 */
export {};
