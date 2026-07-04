# CLAUDE.md — TrustPe LLM Development Guide

This file gives Claude (and other LLMs) the context, rules, and conventions for working in this codebase. **Read this before making any code changes.**

---

## What this project is

TrustPe is a trust-based P2P lending marketplace for India. Phase 1 = closed friends-and-family pilot, 30–50 users, single city, React Native (Expo) Android app + Next.js admin + Express backend + MongoDB. Zero-cost free-tier infrastructure.

Authoritative sources (read in order before any work):

1. `docs/ARCHITECTURE.md` — system design, decisions, regulatory posture
2. `docs/TESTING.md` — what to test and how
3. `docs/BUILD_PLAN.md` — current sprint, scope, gates

If a question isn't answered in these docs, ask the user — do not invent.

---

## Repository layout (MVC)

```
trustpe/
├── backend/                Express + TypeScript backend (MVC)
│   ├── src/
│   │   ├── config/         env, database, redis
│   │   ├── models/         Mongoose schemas (User, Profile, Loan, ...)
│   │   ├── controllers/    request handlers (one file per resource)
│   │   ├── routes/         Express routers (one file per resource)
│   │   ├── services/       business logic + external API integrations
│   │   ├── middleware/     auth, validation, error, rate limit
│   │   ├── jobs/           BullMQ workers (Sprint 3+)
│   │   ├── socket/         Socket.io setup (Sprint 2+)
│   │   ├── utils/          logger, jwt, crypto
│   │   ├── types/          backend-only TS types
│   │   └── server.ts       entry point
│   └── tests/{unit,integration}/
├── mobile/                 React Native Expo Android user app
│   ├── app/                Expo Router screens
│   ├── components/
│   ├── services/           API client, UPI Intent, OCR, push, secure store
│   ├── hooks/
│   └── utils/
├── admin/                  Next.js admin panel
│   └── src/app/            App Router pages
├── shared/                 Shared between backend + mobile + admin
│   ├── schemas/            Zod schemas (the contract)
│   ├── types/              Pure TS types (Paise, IsoDateString, ApiResponse)
│   └── constants/          Tier caps, score bands, ROI cap, etc.
└── docs/                   Architecture, testing, build plan, runbooks
```

`shared/` is imported via the `@shared/*` path alias — set up in each app's tsconfig, babel (mobile), and webpack (admin).

---

## The four core engineering principles

These come from `ARCHITECTURE.md` and override any other consideration:

1. **Adapter discipline (services layer).** External API calls (Cashfree, Cloudinary, Resend, Digio, etc.) live in `backend/src/services/<provider>.service.ts`. Controllers never call external services directly. Domain logic in services never imports the SDK directly; it goes through a thin wrapper service. This is how we keep the Phase 2 upgrade path open (swap `payment-verification.service.ts` to use Cashfree without touching controllers).
2. **Phased deliverability.** Phase 1 ships on free tiers, zero-cost, by a solo developer. Don't add paid services or complex infra without explicit user approval.
3. **Trust is a first-class object.** Profile health, vouches, reputation, behavioral signals are part of the core domain. Reflect them in schemas from day 1 even if UI ships later.
4. **Audit everything that touches money or identity.** Every write to a money-touching or KYC-touching collection produces an `audit_logs` entry with actor, timestamp, IP, device fingerprint, and before/after diff. No exceptions.

---

## Where code goes

| Code type | Location |
|---|---|
| Zod schemas (shared) | `shared/schemas/` |
| Shared TS types | `shared/types/` |
| Shared constants (caps, thresholds) | `shared/constants/` |
| Mongoose models | `backend/src/models/<Entity>.ts` |
| Request handlers (thin) | `backend/src/controllers/<resource>.controller.ts` |
| Express routers | `backend/src/routes/<resource>.routes.ts` |
| Business logic | `backend/src/services/<feature>.service.ts` |
| External SDK wrappers | `backend/src/services/<provider>.service.ts` |
| Middleware | `backend/src/middleware/<name>.ts` |
| Cron jobs / workers | `backend/src/jobs/<name>.job.ts` |
| Socket.io handlers | `backend/src/socket/<event>.ts` |
| Utility helpers | `backend/src/utils/<name>.ts` |
| RN screens | `mobile/app/` (Expo Router file-based) |
| RN components | `mobile/components/` |
| RN API client | `mobile/services/api.ts` |
| RN UPI Intent | `mobile/services/upi-intent.ts` |
| Admin pages | `admin/src/app/` (Next.js App Router) |

**Dependency direction:** controllers → services → models. Services may call other services. Models never call services or controllers. Mobile + admin import shared schemas/types from `@shared/*` only.

---

## Controller / service / model split — the rule

Controllers are **thin**. They:

1. Parse `req.body` / `req.query` / `req.params` through a Zod schema imported from `@shared/schemas`.
2. Call exactly one service method.
3. Format the response into the success/error envelope.
4. Nothing else.

No DB queries in controllers. No external API calls in controllers. No business logic in controllers.

Services hold:

- Business logic (TrustScore calc, EMI math, state-machine transitions, eligibility checks)
- External API calls (Cashfree, Cloudinary, Digio — each in its own `<provider>.service.ts`)
- DB writes that touch multiple collections (use transactions)
- Audit log writes for state changes

Models hold:

- Mongoose schema + indexes + virtual fields
- Pre/post middleware (e.g., auto-write audit-log on money-touching saves)
- Static helpers for common queries

Example controller skeleton:

```ts
// backend/src/controllers/loan.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { createLoanRequestSchema } from '@shared/schemas';
import { loanService } from '../services/loan.service.js';

export const loanController = {
  async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createLoanRequestSchema.parse(req.body);
      const loan = await loanService.createRequest(req.user!.id, input);
      res.status(201).json({ ok: true, data: loan });
    } catch (err) {
      next(err);
    }
  },
};
```

---

## TypeScript conventions

- **Strict mode**, always. `tsconfig.base.json` enforces `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.
- **No `any` without justification.** Add `// @reason: <why>` on the same line.
- **Prefer `type` over `interface`** for data shapes. `interface` only for class contracts.
- **No `enum`s.** Use string literal unions.
- **Money types**: always integer paise as `number`. Variable names end in `Paise`.
- **Dates**: `Date` in code, ISO 8601 strings on wire. Zod handles conversion.
- **IDs**: `string` everywhere. Convert Mongo ObjectIds at the API boundary.

---

## Zod schemas — the contract

Every data shape that crosses an API boundary has a Zod schema in `shared/schemas/`. The schema is the source of truth:

```ts
// shared/schemas/loanRequest.ts
import { z } from 'zod';
import { MIN_LOAN_AMOUNT_PAISE, MAX_LOAN_AMOUNT_PAISE } from '../constants/index.js';

export const createLoanRequestSchema = z.object({
  amountPaise: z.number().int().min(MIN_LOAN_AMOUNT_PAISE).max(MAX_LOAN_AMOUNT_PAISE),
  tenureMonths: z.number().int().min(1).max(6),
  purpose: z.string().min(10).max(500),
  roiPercent: z.number().min(0).max(36),
});

export type CreateLoanRequestInput = z.infer<typeof createLoanRequestSchema>;
```

Backend imports for body validation. Mobile + admin import for React Hook Form resolvers. **Same shape, three consumers, one definition.**

---

## Services and the Phase 2 swap path

Services hold all external SDK calls behind named functions. Phase 1 implementation:

```ts
// backend/src/services/payment-verification.service.ts
import { logger } from '../utils/logger.js';

export const paymentVerificationService = {
  async verifyUpiId(vpa: string, expectedName: string) {
    // Phase 1: OCR + admin manual review
    return { status: 'manual_review', vpa, expectedName };
  },

  async submitPayerEvidence(/* ... */) {
    // Phase 1: store screenshot/Intent return, validate against expected
  },
};
```

Phase 2 swap means editing this single file to call Cashfree under the hood. The controllers and routes don't change. The shape of inputs/outputs stays the same.

---

## Audit logging — never bypass

Every write to a money-touching or identity-touching collection writes an `audit_logs` row. Enforced through Mongoose middleware on those models plus explicit calls in services that touch state.

Money-touching collections: `payment_intents`, `payments`, `loans`, `emi_schedules`, `agreements`
Identity-touching collections: `users`, `profiles`, `kyc_records`, `upi_registrations`, `refresh_tokens`, `device_sessions`

Pattern:

```ts
await session.withTransaction(async () => {
  await loanModel.updateOne({ _id }, { $set: { status: 'ACTIVE' } }, { session });
  await auditLogModel.create([{
    at: new Date(),
    actorType: 'user',
    actorId: ctx.userId,
    action: 'loan.disbursed',
    entityType: 'loan',
    entityId: loanId,
    before: { status: 'AWAITING_DISBURSAL' },
    after: { status: 'ACTIVE' },
    ip: ctx.ip,
    deviceFingerprint: ctx.deviceFingerprint,
    userAgent: ctx.userAgent,
    traceId: ctx.traceId,
  }], { session });
});
```

If you're writing a state change without an audit log entry, you're doing it wrong.

---

## Idempotency on money-touching endpoints

Every endpoint that moves state related to money requires an `Idempotency-Key` header (UUID). Server stores key + response hash for 24h. Replay returns the cached response.

Implemented as `backend/src/middleware/idempotency.ts` (added in Sprint 3). Applied to `/v1/loans/:id/disburse`, `/v1/loans/:id/payments`, `/v1/payments/:id/payer-evidence`, etc.

---

## Testing rules

See `docs/TESTING.md` for the full strategy. Quick rules:

- Every service function has unit tests
- Every controller has at least one integration test (happy + one failure)
- Every money-touching path has an idempotency test
- Test data uses named fixtures in `backend/tests/fixtures/`
- No `console.log` in committed code — use the Pino logger in backend, structured logging in RN

---

## File size discipline

Prefer many small files over few large ones. Targets:

- TS source files: <300 lines
- Test files: <500 lines
- Controllers: <100 lines per file (one resource per file)
- Services: <300 lines per file (split by feature)
- RN screens: <250 lines (extract components when growing)

---

## Naming conventions

- **Files**: `kebab-case.<role>.ts` (e.g., `loan.controller.ts`, `payment-verification.service.ts`). `PascalCase.ts` only for class/type exports like `User.ts` model.
- **Variables, functions**: `camelCase`
- **Types, classes**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Mongoose models**: singular `PascalCase` (`User`, not `Users`)
- **Mongo collections**: plural snake_case (`users`, `payment_intents`)
- **API routes**: kebab-case in URLs (`/loan-requests/:id`)
- **React components**: `PascalCase`, one component per file
- **Hooks**: `useThing()` always
- **Money fields**: end with `Paise`

---

## Comments

- Use comments to explain **why**, not **what**.
- Reference specs: `// See ARCHITECTURE.md §6.3.3`.
- TODOs include the issue: `// TODO(#42): handle iOS Intent return`.
- No restating-the-obvious comments.

---

## When in doubt

1. Check `ARCHITECTURE.md` (section numbers are stable references).
2. Match an existing similar pattern in the codebase.
3. Ask the user — don't invent business logic.
4. Default to the boring, well-known option.

---

## Things this codebase deliberately doesn't do

Intentional choices from `ARCHITECTURE.md`. Don't add without user approval:

- No `enum`s (string literal unions)
- No Redux / Zustand in RN (Context + TanStack Query)
- No CSS-in-JS in RN (NativeWind)
- No GraphQL (REST + Socket.io)
- No microservices in Phase 1 (monolith Express)
- No Docker for production deploy (Render handles container)
- No webhook receivers from Cashfree/Razorpay in Phase 1 (not integrated)
- No SMS in Phase 1 (email + push only)
- No WhatsApp in Phase 1 (Phase 2)
- No iOS in Phase 1 (Phase 2)
- No public marketing website in Phase 1 (Phase 2)
- No pooling of lender funds across borrowers ever (RBI rule)
- No promised returns to lenders ever (RBI rule)
- No insurance cross-sell ever (RBI rule)

---

## Active sprint

Current sprint: **Sprint 0 — Foundation**. See `docs/BUILD_PLAN.md` §3 and `docs/sprint-status.md` for current scope and test gates.
