# TrustPe — Testing Strategy

**Version:** 0.1.0
**Status:** Active — referenced from every sprint
**Owner:** Bhagirath
**Related:** `ARCHITECTURE.md` (overall design) • `BUILD_PLAN.md` (sprint gates)

---

## 1. Philosophy

Three goals, in priority order:

1. **Catch bugs that hurt users or move money incorrectly** — before they reach beta users.
2. **Run fast enough that we never skip them** — every PR, every push.
3. **Document the system behavior** — tests as executable spec for future maintainers (including the LLM).

We are intentionally not chasing 100% coverage. We are chasing 100% confidence on the **money-touching, identity-touching, and state-changing paths**. Trivial getters, UI presentation polish, and code that is obviously correct gets less test attention.

The order of preference when writing a new feature is: (a) make invalid states unrepresentable in the type system; (b) zod schema validation at boundaries; (c) unit tests on pure domain logic; (d) integration tests on the API surface; (e) E2E tests only for critical user journeys.

---

## 2. The pyramid

```
                            /\
                           /  \    Manual QA (per-release checklist)
                          /────\
                         / E2E  \   Maestro (RN) + Playwright (admin)
                        /────────\  ~10 tests total, critical paths only
                       / Integ.   \  Vitest + mongodb-memory-server
                      /────────────\ ~50 tests, one per use-case
                     /   Unit       \ Vitest, packages/core only
                    /────────────────\ ~200+ tests, pure functions
                   /  Type system + Zod \
                  /──────────────────────\ "Tests" the compiler runs for free
```

| Layer | Tool | Speed | Coverage focus | Count |
|---|---|---|---|---|
| Type system + Zod | TypeScript strict + Zod | Instant (compile) | All data boundaries | N/A — every line |
| Unit | Vitest | <1s total | Domain logic in `packages/core` | ~200+ |
| Integration | Vitest + mongodb-memory-server + supertest | ~10s total | One per API use-case | ~50 |
| E2E (RN) | Maestro | ~5min per flow | Critical user journeys only | ~5 |
| E2E (admin) | Playwright | ~2min per flow | Critical admin journeys only | ~5 |
| Manual QA | Founder + test device | Variable | UPI Intent, biometrics, push, OCR on real apps | Checklist per release |

---

## 3. What goes where

### 3.1 `packages/core` — unit tests

This is where the most testable code lives: TrustScore calculation, EMI math, state machine transitions, eligibility rules, zod schema validation, formatters, validators. Every module ships with its own `*.test.ts` next to it.

```
packages/core/src/
├── domain/
│   ├── trust/
│   │   ├── HealthEngine.ts
│   │   ├── HealthEngine.test.ts          ← unit tests
│   │   ├── EligibilityLadder.ts
│   │   └── EligibilityLadder.test.ts
│   ├── loan/
│   │   ├── EmiSchedule.ts
│   │   ├── EmiSchedule.test.ts
│   │   ├── loanMachine.ts
│   │   └── loanMachine.test.ts
│   └── payment/
│       ├── PaymentIntent.ts
│       └── PaymentIntent.test.ts
└── schemas/
    ├── user.ts
    ├── user.test.ts                       ← zod schema tests
    └── ...
```

**Coverage target**: ≥90% line, ≥85% branch. Anything in `packages/core` that touches money or trust must have a unit test before merge.

**Test data**: shared factories in `packages/core/src/test-fixtures/`. No magic numbers in tests — everything pulled from named fixtures so when defaults change, tests still read clearly.

### 3.2 `apps/api` — integration tests

Real Express handlers, real Mongoose models, real Mongo (in-memory via `mongodb-memory-server`). One test file per resource, multiple tests per use-case.

```
apps/api/src/
├── routes/
│   └── loans/
│       ├── createRequest.ts
│       ├── createRequest.test.ts          ← integration test
│       ├── makeOffer.ts
│       ├── makeOffer.test.ts
│       └── ...
└── test-utils/
    ├── testApp.ts                         ← booted Express + in-memory Mongo
    ├── seedUsers.ts
    └── seedLoans.ts
```

**What each integration test covers per use-case:**

- Happy path: correct input → correct output → correct state changes → audit log entry written
- Validation failure: invalid input → 400 with field-level error
- Authorization failure: wrong user → 403
- Idempotency: same `Idempotency-Key` → cached response, no duplicate state change
- Edge case relevant to the use-case (e.g., for `makeOffer`, an expired loan request returns 410)

**Money-touching paths get extra scrutiny:**

- Test that audit log entry is created
- Test that state transition is atomic (Mongo transaction rollback on partial failure)
- Test that idempotency key prevents double-spend
- Test the retraction window (24h after receiver attestation)
- Test that rate limits actually rate-limit

**Coverage target**: ≥70% on `apps/api/src/routes/` and `apps/api/src/usecases/`. Lower expectations for adapter code that's mostly delegation.

### 3.3 RN app — Maestro E2E + component unit tests

**Component unit tests** (Vitest + React Native Testing Library): for components with non-trivial logic only. Skip pure presentation. Cover form validation, conditional rendering based on user state, and any local state machines.

**Maestro flows**: critical user journeys end-to-end on a real or emulated Android device. Maestro YAML files in `apps/mobile/.maestro/`:

```
apps/mobile/.maestro/
├── 01-signup-and-kyc.yaml
├── 02-create-loan-request.yaml
├── 03-make-offer-and-accept.yaml
├── 04-disburse-and-attest.yaml       ← uses mock UPI app
├── 05-pay-emi-and-confirm.yaml
└── 06-dispute-flow.yaml
```

**Mocking UPI Intent**: Maestro can't drive a real UPI app, so we ship a `MockUpiIntentModule` for E2E builds that returns a configurable Intent result. The production build never includes this module. Switched via Expo build profile (`development` / `preview` / `production`).

**Coverage target**: Maestro doesn't measure coverage; we measure flow completion. All six flows must pass on every release.

### 3.4 Admin panel — Playwright E2E

Five tests covering the critical admin journeys:

```
apps/admin/tests/
├── login-and-2fa.spec.ts
├── kyc-review-approve.spec.ts
├── kyc-review-reject.spec.ts
├── dispute-adjudicate.spec.ts
└── payment-exception-resolve.spec.ts
```

Playwright runs in headless mode on CI, headed locally for debugging.

---

## 4. Type system as a free test layer

We lean heavily on TypeScript strict mode and Zod runtime validation as a first line of defense. This gives us:

- Compile-time prevention of shape mismatches between client and server (both import from `packages/core`)
- Runtime prevention of malformed data at every API boundary (Zod parsing on input)
- A self-documenting contract — the schema IS the documentation

Rules:

- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitAny: true` in `tsconfig.base.json`
- No `any` without a justification comment
- Every API endpoint validates `req.body` / `req.query` / `req.params` with a Zod schema imported from `packages/core/schemas/`
- Every external response (Cashfree, Cloudinary, etc.) is validated through a Zod schema before entering the domain — we never trust shapes from external systems

---

## 5. CI integration

GitHub Actions workflow (`.github/workflows/ci.yml`):

```yaml
on: [pull_request, push]
jobs:
  validate:
    steps:
      - checkout
      - setup pnpm + node
      - pnpm install --frozen-lockfile
      - pnpm turbo run lint typecheck test --filter='!apps/mobile'   # unit + integration
      - pnpm turbo run test:e2e --filter='apps/admin'                # Playwright
  mobile:
    steps:
      - checkout
      - setup pnpm + node + Java
      - pnpm install --frozen-lockfile
      - pnpm turbo run lint typecheck test --filter='apps/mobile'   # RN unit tests
      - eas build --platform android --profile preview --non-interactive   # build APK
      - run Maestro flows against the preview APK in cloud emulator
```

**Gates:**

- PR cannot merge without all CI green
- `main` branch protected; only PRs allowed
- On merge to `main`: auto-deploy to staging, run smoke E2E
- Release builds require manual approval

**Speed targets:**

- Unit + integration tests: <60 seconds total
- Maestro flows: <10 minutes total (parallelized)
- Full PR validation including mobile build: <20 minutes

---

## 6. Manual QA — what gets a checklist

These are the things automated tests genuinely cannot cover, or where automated coverage would be more expensive than the bug it prevents:

**Pre-release manual checklist (founder runs before each sprint release):**

1. **UPI Intent flow with real apps** — pay ₹1 via GPay, PhonePe, Paytm, BHIM each. Confirm Intent return arrives, payment_intent transitions to `payer_confirmed`, audit log captures full return string.
2. **OCR fallback** — manually disable Intent return module, pay via a UPI app, capture screenshot, confirm OCR extracts UTR/amount/payee VPA correctly, confirm card pre-fills.
3. **Biometric unlock** — enroll fingerprint, log in, kill app, reopen, biometric prompt appears, unlock works. Repeat with face unlock if available.
4. **Push notification delivery** — trigger each notification kind from admin, confirm device receives push within 5 seconds.
5. **Real-time chat** — open chat on two devices, send 10 messages, verify ordering, typing indicators, read receipts work.
6. **Network-loss recovery** — turn on airplane mode mid-flow, restore network, confirm app resumes correctly without data loss.
7. **Deep-link handling** — open a `trustpe://loans/<id>` link from email, confirm correct screen opens with auth.
8. **Screenshot capture guide** — verify the per-app capture guide renders correctly for GPay/PhonePe/Paytm/BHIM/Amazon Pay/CRED/WhatsApp Pay.
9. **Admin KYC review flow** — submit a KYC from device, confirm appears in admin queue with all docs visible, approve, confirm user state updates and push notification fires.
10. **Receiver retraction window** — attest as receiver, wait 1 minute, retract, confirm transitions to `confirmation_retracted_review`.

Each item: pass / fail / blocker note. Captured in `docs/qa-runs/YYYY-MM-DD.md`.

---

## 7. Per-feature test plans

Detailed test plan for each major feature, kept in sync with the architecture spec. Sprint planning references these when scoping.

### 7.1 Authentication and session

Unit tests:
- JWT signing + verifying produces expected claims
- Refresh token rotation: old token revoked, new token issued, chain hashed correctly
- Theft detection: replay of revoked refresh token kills chain and emits security event

Integration tests:
- Signup with invite code: row created in `users`, OTP hash in Redis with TTL
- OTP verify: correct OTP returns access + refresh; incorrect returns 401
- Refresh exchange: rotation works, double-use of same refresh kills chain
- Logout: refresh token revoked, can't be used to refresh
- Logout-all: all device sessions revoked

Manual:
- Biometric unlock cold-start and warm-start
- Token persists across app force-quit (SecureStore)

### 7.2 KYC submission and review

Unit tests:
- Zod schema rejects malformed Aadhaar number, malformed PAN, missing fields
- KYC status state machine: `submitted → under_review → approved | rejected | clarification_requested`

Integration tests:
- KYC submission: docs uploaded to Cloudinary mock, `kyc_records` row created, status `submitted`
- Admin approve: `users.kycStatus` updates, `health_snapshots` row written, audit log entry created
- Admin reject with reason: status `rejected`, reason stored, push notification dispatched

Manual:
- Real Aadhaar / PAN / selfie video captured on device, uploaded, reviewed in admin panel, approved
- UPI screenshot OCR extracts VPA and name correctly on at least three UPI apps

### 7.3 UPI ID registration

Unit tests:
- VPA syntax validator (regex)
- Name fuzzy match (Levenshtein threshold 0.80)
- OCR extraction patterns

Integration tests:
- Submit UPI registration with screenshot: stored in Cloudinary, `upi_registrations` row created with `verificationMethod: 'pending'`
- High-confidence OCR match: auto-approves to `ocr_screenshot_auto`
- Low-confidence OCR: admin queue, admin override updates `verificationMethod: 'admin_manual'`
- Duplicate VPA across users: rejected with 409

Manual:
- Real UPI screenshot from GPay/PhonePe/Paytm uploaded, OCR confidence captured, admin sees both raw image and OCR text

### 7.4 Loan request lifecycle

Unit tests:
- State machine transitions (DRAFT → OPEN → NEGOTIATION → AGREEMENT_PENDING → AWAITING_DISBURSAL → ACTIVE → CLOSED/PRECLOSED/DEFAULTED)
- Invalid transitions throw

Integration tests:
- Create request: amount within tier cap, tenure within tier cap
- Make offer: only when request is OPEN; lender within self-declared capacity
- Accept offer: sibling offers rejected, agreement generated, chat thread created — all in one transaction
- Expire request: TTL job marks as EXPIRED, no further offers accepted

Manual:
- End-to-end on real device: create request, see in lender browse, make offer, negotiate via chat, accept, see agreement PDF

### 7.5 Payment verification (the hardest one)

Unit tests:
- UPI Intent return parser handles all NPCI-spec fields
- Amount validation tolerates rounding (₹15,000.00 vs ₹15000)
- UTR pattern validator (12-digit numeric)
- OCR extraction regex patterns

Integration tests:
- Submit Intent return: SUCCESS status → `payer_confirmed`; FAILURE → no state change; SUBMITTED → polling triggered
- Submit screenshot OCR fallback: server re-validates raw OCR text against client-claimed extraction
- Receiver attests received: `auto_verified`, loan to ACTIVE
- Receiver attests not_received: dispute opened
- Receiver attests received, then retracts within 24h: `confirmation_retracted_review`, admin queued
- Idempotency: submitting same Intent twice produces same response, no duplicate payments

Manual (highest priority for Sprint 3):
- Real UPI payment via each of GPay/PhonePe/Paytm/BHIM, confirm Intent return arrives, payment marked confirmed
- Force OCR fallback (disable Intent module temporarily), confirm screenshot upload + OCR works
- Test retraction window UX

### 7.6 TrustScore engine

Unit tests:
- Every factor's contribution: KYC complete → +60, default → −250, etc.
- Score clamping to [300, 900]
- 365-day default cap to 549
- Snapshot persisted on every recompute

Integration tests:
- KYC approval triggers recompute
- Loan closed on time triggers recompute and snapshot
- Loan defaulted triggers recompute, drops tier
- Daily cron recomputes for users with stale snapshots

### 7.7 Disputes

Unit tests:
- Dispute state machine
- Decision effects on TrustScore (borrower_favor, lender_favor, split, inconclusive)

Integration tests:
- Open dispute: counterparty notified, status `response_awaited`
- Counterparty responds with evidence: status `under_review`
- Admin resolves: state transitions correctly, score impacts applied, audit log written

### 7.8 Notifications

Unit tests:
- Routing matrix: each notification kind goes to the correct channels
- Template renders with correct placeholders

Integration tests:
- Notification orchestrator fans out to email + in-app providers
- Failed delivery on one channel doesn't block others
- `notifications` collection records per-channel delivery status

Manual:
- Push token registration on app first-launch
- Push delivery within 5 seconds of trigger
- Push deep-link routing on tap

### 7.9 Real-time chat

Unit tests:
- Message validation (length, allowed attachment types)
- Off-platform regex detection (UPI ID / phone number patterns)

Integration tests:
- Send message: persisted, broadcast to room, unread counts updated
- Typing indicator broadcast (ephemeral)
- Read receipt persisted

Manual:
- Two-device test: messages arrive in order, typing indicators work, read receipts work, attachments upload and render

### 7.10 Admin operations

Integration tests:
- All admin endpoints require admin JWT
- Admin RBAC: each role can only do what it's allowed
- Every admin write produces audit log with admin user ID

Manual:
- KYC queue, dispute queue, payment exception queue all render correctly
- Feature flag toggles take effect without redeploy

---

## 8. Test data and fixtures

A small set of canonical fixtures lives in `packages/core/src/test-fixtures/`:

- `users.ts`: alice (lender, T2 tier, TrustScore 700), bob (borrower, T1 tier, TrustScore 600), charlie (new user, T0), dave (defaulted user, capped at 549)
- `loans.ts`: active loan, defaulted loan, pre-closed loan, expired request
- `kyc.ts`: complete KYC, partial KYC, rejected KYC
- `upiRegistrations.ts`: verified VPA, pending VPA, name-mismatch VPA

Tests reference these fixtures by name. When defaults change in the spec (e.g., a new tier cap), only the fixture changes; tests still pass or visibly fail at the right line.

---

## 9. What we deliberately don't test

For honesty and time discipline:

- **Visual regressions** — no Percy / Chromatic. Manual eyeball check.
- **Performance benchmarking** — no load tests in Phase 1. Render free tier handles our 30–50 users easily.
- **Cross-browser admin panel** — admin is for the founder only. Chrome on laptop is the only supported environment in Phase 1.
- **iOS RN app** — not built in Phase 1.
- **Old Android versions** — minimum API 23 (Android 6.0) supported, tested against API 30+. If someone has an older device, they get manual support.
- **Internationalization** — English only in Phase 1.

These get attention in Phase 2 or beyond.

---

## 10. Reading list for whoever is implementing

Tests are documentation. Future engineer (or LLM) ramp-up order:

1. Read `ARCHITECTURE.md` for the system shape
2. Read `SCHEMAS.md` for data shapes
3. Read tests in `packages/core/src/domain/` for canonical examples of intended behavior
4. Read integration tests in `apps/api/src/routes/loans/` for how use-cases are wired
5. Read Maestro flows for what a real user journey looks like

The architecture document tells you what we built. The tests tell you what it actually does.
