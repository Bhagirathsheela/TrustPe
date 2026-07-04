# TrustPe — Build Plan

**Version:** 0.1.0
**Status:** Active — referenced from every sprint
**Owner:** Bhagirath
**Related:** `ARCHITECTURE.md` (overall design) • `TESTING.md` (test strategy)

---

## 1. Cadence and assumptions

- **Sprint length:** 2 weeks
- **Total duration:** 12 weeks (6 sprints) to first 5-user closed beta
- **Capacity:** solo founder + LLM-assisted (Claude / Cursor), ~30 productive hours/week
- **Working calendar:** assume 1 sprint = 10 working days = ~60 hours of build time
- **Buffer:** every sprint reserves 20% of capacity for unknowns, code review, and re-work
- **End of every sprint:** demoable build + Manual QA checklist run + sprint retrospective note in `docs/sprint-retros/`

---

## 2. Sprint map

| Sprint | Weeks | Theme | Demoable outcome |
|---|---|---|---|
| 0 | 1 (warm-up week) | Foundation | Empty monorepo builds, lints, tests green; auth shell on backend; RN app boots with hello-world; admin Next.js boots |
| 1 | 2–3 | Auth + Profile + KYC + UPI registration | User installs APK, signs up, completes KYC, registers UPI via OCR; admin reviews and approves |
| 2 | 4–5 | Loan request, offer, negotiation, agreement | Full end-to-end loan creation through agreement signing, with chat |
| 3 | 6–7 | UPI payment + lifecycle + EMI engine | Lender disburses via UPI Intent; borrower attests; EMI schedule generated; EMI paid back end-to-end |
| 4 | 8–9 | TrustScore + Reviews + Disputes + Notifications | Score updates after every event; reviews leave impact; disputes can be opened and resolved; push notifications fire |
| 5 | 10–12 | Polish + Closed beta launch | First 5 friends invited; first real loans transacted; operational runbook complete |

---

## 3. Sprint 0 — Foundation (Week 1)

**Goal:** every following sprint can start by writing feature code, not configuration.

### Deliverables

1. **Repo skeleton** under `E:\personal-work\TrustPe\`:
   - Root: `package.json` (delegated scripts), `tsconfig.base.json` (strict), `.eslintrc.cjs`, `.prettierrc`, `.editorconfig`, `.nvmrc`, `.gitignore`, `.env.example`, `docker-compose.yml`
   - `.github/workflows/ci.yml`
   - `CLAUDE.md` and `.cursorrules` (LLM-assist conventions, MVC-aware)
   - `README.md`
2. **`shared/` skeleton**: `package.json`, `tsconfig.json`, `index.ts`, subfolders `schemas/`, `types/`, `constants/`, smoke test on Paise type.
3. **`backend/` MVC skeleton** under `backend/src/`:
   - `server.ts` (entry) + `app.ts` (Express factory)
   - `config/env.ts` (Zod-validated env loader) + `config/database.ts` (Mongo connect stub)
   - `utils/logger.ts` (Pino with redact)
   - `middleware/error-handler.ts` + `middleware/not-found-handler.ts`
   - `routes/index.ts` (root router) + `routes/health.routes.ts`
   - `controllers/health.controller.ts`
   - `tests/integration/health.test.ts` (supertest smoke)
   - `.env.example`, `tsconfig.json`, `vitest.config.ts`, `.eslintrc.cjs`, `README.md`
4. **`admin/` Next.js skeleton**: App Router + Tailwind + `@shared/*` alias via tsconfig and webpack.
5. **`mobile/` Expo skeleton**: Expo Router + plugins (camera, secure-store, biometrics, image-picker, notifications, linking, constants) + `@shared/*` alias via babel-plugin-module-resolver + metro watchFolders + tsconfig.
6. **`eas.json`** in mobile with dev/preview/production profiles.
7. **CI green** on hello-world commit: four parallel jobs (shared, backend, admin, mobile) all pass.
8. **Dev runbook** with `bun install` per folder, `bun run dev:*` commands, troubleshooting.
9. **Spike**: prototype the UPI Intent native module on a real Android device. Verify `startActivityForResult` with `upi://pay` returns NPCI-spec fields (Status, txnRef, Amount, responseCode). De-risks Sprint 3.

### Test gate

- `pnpm turbo run lint typecheck test` exits 0
- CI workflow green on a commit
- Manual: APK builds via EAS, installs on real Android device, opens to hello-world screen
- Manual: UPI Intent spike works — fires Intent, picks GPay, returns to app with parsed result

### Out of scope this sprint

- Any real feature code
- Database schemas beyond `_migrations` collection
- Authentication
- Anything user-visible beyond hello-world

### Risks and mitigations

- **Risk**: Expo native module setup is harder than expected. **Mitigation**: spike on day 1 of the sprint, not day 5.
- **Risk**: Turborepo + pnpm + Expo combination has known sharp edges. **Mitigation**: start from the official Expo monorepo template, not from scratch.

---

## 4. Sprint 1 — Auth + Profile + KYC + UPI registration (Weeks 2–3)

**Goal:** a real user can install the APK, sign up with an invite, complete KYC, and have their account approved by admin.

### Backend deliverables (`apps/api`)

- `users`, `profiles`, `kyc_records`, `upi_registrations`, `invites`, `refresh_tokens`, `device_sessions`, `audit_logs`, `notifications`, `health_snapshots`, `feature_flags` collections created with Mongoose models
- Indexes per `SCHEMAS.md`
- Zod schemas in `packages/core/schemas/` for every collection
- Auth endpoints:
  - `POST /v1/auth/signup` (with invite code, phone, email)
  - `POST /v1/auth/verify-otp`
  - `POST /v1/auth/refresh`
  - `POST /v1/auth/logout`
  - `GET /v1/me`
- Profile endpoints:
  - `PATCH /v1/me/profile`
- KYC endpoints:
  - `POST /v1/me/kyc` (with Cloudinary signed-upload prereq)
  - `GET /v1/me/kyc`
- UPI registration endpoints:
  - `POST /v1/me/upi` (with Cloudinary screenshot + client-side OCR payload)
  - `GET /v1/me/upi`
- Admin endpoints:
  - `GET /v1/admin/kyc-queue`
  - `POST /v1/admin/kyc/:userId/approve`
  - `POST /v1/admin/kyc/:userId/reject`
- Audit log middleware: every write to KYC, UPI, user state writes an `audit_logs` row
- TrustScore baseline calculation when KYC is approved (just the KYC and account-age factors active)
- Email OTP via Resend
- Refresh token rotation with theft detection

### RN user app deliverables (`apps/mobile`)

- Auth screens: invite code, signup, email OTP entry
- Onboarding screens: profile (name, photo, occupation, declared income, city), KYC capture (Aadhaar front + back, PAN front, selfie video — all via Expo Camera/ImagePicker)
- UPI setup screen: type VPA, capture UPI app screenshot, run Tesseract OCR in-app, show extraction preview
- Pending review screen
- Home screen (placeholder)
- API client with auto-refresh
- Expo SecureStore integration for refresh token
- Expo LocalAuthentication setup
- Expo Push registration on first login

### Admin panel deliverables (`apps/admin`)

- Login + 2FA
- KYC review queue (table view)
- KYC detail page (view all uploaded docs, OCR extraction, approve / reject / request clarification)
- User detail page (read-only)
- Audit log viewer (filterable)

### Test gate

- **Unit**: TrustScore baseline calculation, refresh token rotation, OCR pattern extraction regex
- **Integration**: full auth flow (signup → OTP → refresh → logout); KYC submission and approval; UPI registration with OCR auto-approval and admin override
- **E2E (Playwright admin)**: admin login → review pending KYC → approve → confirm user state updated
- **Maestro (RN)**: signup happy path through KYC submission
- **Manual QA**: real device install via EAS internal link, full onboarding flow, real Aadhaar/PAN photos captured by camera, real UPI screenshot OCR'd, admin approval triggers push notification

### Sprint demo

Founder signs up as a new user on their personal phone, completes KYC, gets reviewed and approved by admin, opens the home screen showing the new TrustScore badge.

### Risks and mitigations

- **Risk**: Cloudinary signed-upload flow from RN is fiddly. **Mitigation**: write the Cloudinary adapter and a quick test app early in week 2; verify signed URL signing and upload work before building UI on top.
- **Risk**: Camera permissions / Aadhaar capture quality. **Mitigation**: ship with a "review your captures" preview screen so user can retake before submission.

---

## 5. Sprint 2 — Loans, offers, negotiation, agreement (Weeks 4–5)

**Goal:** a borrower can create a loan request, a lender can offer, they can negotiate, and they can sign a click-wrap agreement.

### Backend deliverables

- `loan_requests`, `loan_offers`, `loans`, `chat_threads`, `messages`, `agreements` collections + Mongoose models
- Loan state machine (`packages/core/domain/loan/loanMachine.ts`) — DRAFT → OPEN → NEGOTIATION → AGREEMENT_PENDING → AWAITING_DISBURSAL
- Endpoints:
  - `POST /v1/loan-requests` (create)
  - `GET /v1/loan-requests` (search, paginated, with filters)
  - `GET /v1/loan-requests/:id`
  - `PATCH /v1/loan-requests/:id` (update / cancel)
  - `POST /v1/loan-requests/:id/offers` (make offer)
  - `POST /v1/loan-offers/:id/counter`
  - `POST /v1/loan-offers/:id/accept` (transactional: rejects siblings, creates loan, creates agreement, creates chat thread)
  - `POST /v1/loan-offers/:id/reject`
  - `GET /v1/loans/:id`
  - `GET /v1/loans/:id/agreement` (signed PDF, signed-URL access)
- Agreement generation via PDFKit; template versioned in `apps/api/templates/agreements/`
- Agreement acceptance endpoint records IP, device fingerprint, timestamp, and SHA-256 hash of bytes
- Socket.io `/realtime` namespace with `chat:message`, `chat:typing`, `chat:read` events
- Eligibility ladder enforcement: borrower can only request within their tier cap

### RN user app deliverables

- Borrow flow: create new request, manage own requests
- Lend flow: browse requests, filter by TrustScore band / amount / tenure / city, make offer
- Negotiation chat: real-time, attachment support (Cloudinary signed upload)
- Agreement viewer: PDF inline, scroll-locked accept button, IP + device fingerprint captured at acceptance
- Loan detail screen (read-only, since payments are Sprint 3)

### Admin panel deliverables

- Loan listing (all loans, filterable by state)
- Loan detail (read-only)
- Chat thread viewer (read-only, for audit)

### Test gate

- **Unit**: loan state machine transitions, eligibility ladder enforcement
- **Integration**: create request, make offer, accept offer with transactional rollback test, agreement generation and hash verification, chat message send + persistence
- **Maestro (RN)**: full negotiation flow — borrower creates, lender offers, both chat, borrower accepts, agreement signed
- **Manual QA**: agreement PDF renders correctly, IP + device data captured at acceptance, chat works across two devices

### Sprint demo

Two devices side-by-side: borrower creates a request, lender on the other device sees it, makes an offer, they chat for a minute, borrower accepts, both view and sign the agreement.

### Risks and mitigations

- **Risk**: PDF rendering edge cases (long names, special characters, currency formatting). **Mitigation**: test template with a wide range of inputs in unit tests; review at least 5 generated PDFs manually.
- **Risk**: Socket.io reconnect on RN can be flaky. **Mitigation**: use `socket.io-client` with default reconnection; manual test on real network changes.

---

## 6. Sprint 3 — UPI payment + lifecycle + EMI (Weeks 6–7)

**Goal:** the loan can move from agreement-signed all the way through to ACTIVE via real UPI payment with native Intent confirmation.

This is the highest-risk sprint. We deliberately scope it tight and reserve buffer.

### Backend deliverables

- `payment_intents`, `payments`, `emi_schedules` collections + Mongoose models
- Payment state machine (in `packages/core/domain/payment/`):
  - `awaiting_payer_evidence` → `payer_confirmed` → `auto_verified` (on receiver attestation)
  - Branches: `low_confidence_review`, `amount_mismatch`, `vpa_mismatch`, `disputed_by_payee`, `confirmation_retracted_review`
- EMI schedule generation engine (`packages/core/domain/loan/EmiSchedule.ts`)
- Endpoints:
  - `POST /v1/loans/:id/disburse` (creates `payment_intent` with status `awaiting_payer_evidence`, returns deep-link payload)
  - `POST /v1/payments/:intentId/payer-evidence` (accepts native Intent return OR screenshot+OCR OR manual UTR)
  - `POST /v1/payments/:intentId/receiver-attestation` (received / not_received / retracted)
  - `GET /v1/loans/:id/emis`
  - `POST /v1/loans/:id/payments` (for EMI payments — same flow as disbursement, roles swapped)
  - `POST /v1/loans/:id/preclose`
- BullMQ workers:
  - EMI reminder cron (3-day, 1-day, due-day push notifications)
  - Payment-intent expiry cron (48h)
  - Receiver-attestation reminder cron (24/36/48h)
  - Daily TrustScore recompute
- Idempotency middleware on all money-touching endpoints
- 24-hour retraction window enforcement

### RN user app deliverables

- Disbursement screen (lender): "Pay borrower ₹X" button → fires UPI Intent → handles result
- Native UPI Intent module (`apps/mobile/modules/upi-intent/`) using `react-native-upi-payment` or custom Expo Dev Client module
- Intent return parser, fallback to OCR screenshot when return is incomplete
- Receiver attestation screen: "Yes, I received / Let me check / I did not receive" with retraction window banner
- EMI schedule screen
- EMI payment screen (same flow as disbursement, role reversed)
- Pre-closure quote and pay screen
- Per-UPI-app capture guide component (`UpiCaptureGuide`)

### Admin panel deliverables

- Payment exception queue (intents with low_confidence / mismatch / disputed / retracted)
- Manual override actions: mark verified, mark failed, refund-instruction generation

### Test gate

- **Unit**: EMI schedule generation (multiple scenarios: equal monthly, leap years, end-of-month dates), payment state machine, retraction window, idempotency
- **Integration**: full payment flow with all branches (success, mismatch, low confidence, retraction, dispute), EMI generation on first disbursal, EMI payment recording, pre-closure with penalty
- **Manual QA — highest priority**:
  - Real UPI Intent payment via each of GPay, PhonePe, Paytm, BHIM. ₹1 test transactions between founder's two UPI accounts.
  - Confirm Intent return arrives with correct fields.
  - Force OCR fallback path, confirm screenshot upload + OCR works.
  - Receiver attestation on second device, confirm loan transitions to ACTIVE.
  - Test retraction within 24h, confirm admin queue triggers.
  - Test EMI payment from borrower → lender direction.

### Sprint demo

Founder borrows ₹1 from a friend on a second device. UPI Intent fires from RN, friend completes via GPay, Intent returns, founder sees "Lender confirmed ₹1." Founder attests "Yes, I received it." Loan moves to ACTIVE. Friend pays the EMI a few minutes later, founder confirms. Loan closes.

### Risks and mitigations

- **Risk**: UPI Intent return data inconsistency across UPI apps. **Mitigation**: spike done in Sprint 0; if any major app returns incomplete data, we have OCR fallback already wired.
- **Risk**: idempotency edge cases on retries. **Mitigation**: dedicated integration test suite for idempotency on every money-touching endpoint.
- **Risk**: time-of-day bugs on EMI date arithmetic (timezones, end-of-month, leap year). **Mitigation**: EMI schedule unit tests cover ~20 scenarios including these edge cases.

---

## 7. Sprint 4 — TrustScore + Reviews + Disputes + Notifications (Weeks 8–9)

**Goal:** every event in the loan lifecycle moves the TrustScore in the right direction, reviews are working, and disputes can be opened and resolved.

### Backend deliverables

- Full TrustScore engine with all factors (`packages/core/domain/trust/HealthEngine.ts`)
- Score recompute triggers on every relevant event
- `health_snapshots` persistence
- `reviews` collection + endpoints (`POST /v1/reviews`, `GET /v1/reviews/:id`)
- `disputes` collection + state machine + endpoints
- Notification orchestrator with full channel routing matrix (in-app + email)
- Default registry: any DEFAULTED loan adds an entry visible on borrower's public profile

### RN user app deliverables

- TrustScore detail screen with breakdown
- Public profile screen (own + others')
- Review submission screen (post-loan-closure)
- Dispute open screen
- Dispute detail with evidence upload
- Notification center (in-app feed)
- Settings: notification preferences, account, security

### Admin panel deliverables

- TrustScore breakdown viewer (per user) with manual recompute
- Dispute queue + detail + adjudication
- Default registry view
- Manual default outreach helper (defaulted loans + suggested message templates)

### Test gate

- **Unit**: every TrustScore factor's delta, score clamping, default cap at 549, decay logic
- **Integration**: complete loan + review → score updates, default → score impact + tier downgrade + registry entry, dispute lifecycle + decision effects
- **Manual QA**: full lifecycle on real devices — loan closes → review left → score updates visibly; dispute → admin resolves → score impacts both parties

### Sprint demo

Same friend pair from Sprint 3 demo. Both leave reviews. TrustScore badge updates visibly. Founder opens a fake dispute, admin resolves on the laptop, score changes propagate to both devices.

---

## 8. Sprint 5 — Polish + Closed Beta launch (Weeks 10–12)

**Goal:** beta-ready. First 5 invited friends complete real loans.

### Sprint 5A — automation + operator dashboard (✅ shipped)

Wired up so the pilot can run with the operator stepping in only for exceptions.

**Backend**
- `jobs/emi-reminder.job.ts` + `jobs/index.ts` — vanilla `setInterval` cron
  (no Redis required for Phase 1). Boots at startup, then every 6 hours.
  Scans active loans, fires `emi_due` / `emi_overdue` notifications at
  T-3d, T-1d, due day, +1d, +7d, +14d. Idempotent via
  `EmiSchedule.installment.reminderSentKinds`.
- `User.notificationPreferences.mutedCategories` — list of muted notification
  categories (loan_activity / payments / emi_reminders / reviews / kyc /
  disputes). Push delivery in `notification.service` checks this before
  fan-out; in-app feed always records.
- `GET/PATCH /me/notification-preferences` — read + update muted categories.
- `GET /admin/users` + `GET /admin/users/:id` — directory + per-user detail
  (profile, KYC, loans on both sides, recent reviews, audit slice).
- `GET /admin/audit-logs` — filterable view across the full AuditLog
  collection (actor, entity, action prefix, date range).

**Mobile**
- `/settings` — account info, profile links, notification preferences,
  about / support, logout. Home screen cog tile routes here; home no
  longer hosts logout.
- `/settings/notifications` — category toggles backed by `mutedCategories`.

**Admin**
- `/users` — searchable directory with status / KYC filters and pagination.
- `/users/[id]` — full member dossier; deep-links into KYC detail and the
  per-user audit log slice.
- `/audit-logs` — filter bar (action prefix, entity type/id, actor id, date
  range) over the entire AuditLog collection; the user-detail page deep-links
  here via query params.

### Polish backlog (week 10)

- Onboarding empty states
- Loading skeletons
- Error boundaries
- Pull-to-refresh on every list
- Form validation messages
- Accessibility pass (TalkBack on Android)
- Per-UPI-app capture guide images finalized
- Email templates designed
- Push notification copy reviewed
- Sentry error-grouping configured
- ✅ Privacy Policy + T&C drafted (`docs/PRIVACY_POLICY.md`,
  `docs/TERMS_AND_CONDITIONS.md`) — both **pending legal review** before
  launch. In-app screens at `/legal/privacy` and `/legal/terms`. Linked
  from signup, settings, and the KYC consent gate. DPDP-Act explicit
  consent checkbox now required before KYC documents leave the device.

### Sprint 5B — production reliability + perceived quality (✅ shipped)

**Error boundary + Sentry-shaped tracker.** Root `ErrorBoundary` class
component catches render/lifecycle crashes with a friendly fallback (retry,
go-home, copy-diagnostics). `mobile/lib/tracker.ts`, `backend/utils/tracker.ts`,
and `admin/lib/tracker.ts` are stub implementations of the Sentry surface
(`init`, `captureException`, `captureMessage`, `addBreadcrumb`, `setUser`,
`clearUser`). Phase 1 logs to console + structured logger; wiring real
Sentry later means swapping the body of each function — call sites stay
unchanged. Backend `error-handler` middleware now calls
`tracker.captureException` on unhandled errors plus `unhandledRejection`
and `uncaughtException` process-level safety nets. Admin gets a Next.js
`app/global-error.tsx`. Auth-context attaches user via `tracker.setUser`
on login and `tracker.clearUser` on logout, plus breadcrumbs for session
events.

**Empty states + skeletons.** New `EmptyState` (icon + headline +
sub + optional CTA) and `Skeleton` primitives
(`SkeletonLine`, `SkeletonCircle`, `SkeletonCard`, `SkeletonList`) with
animated pulse. Applied to `notifications`, `loan-requests/browse`,
`loan-requests/mine`, `loans/mine`, and `loan-offers/mine` — each now
shows a content-shaped skeleton on first load and a specific, friendly
empty state with a relevant CTA when there's nothing.

**Negative edge-case audit + fixes.**
- `notification.service.notify` now bails early on invalid `userId`
  (was silently throwing inside a try/catch and poisoning logs).
- `apiRequest` now has a 30-second `AbortController` timeout (overridable
  per-call via `timeoutMs`). A stuck server no longer freezes the UI; the
  user gets a "took longer than 30s" message and can retry.
- `auth-context.apiCall` threads `timeoutMs` through to the underlying
  request.
- Audited and confirmed safe: agreement double-sign (idempotent), loan
  request first-write-wins claim, payment state guards, chat party
  check, auth refresh deduplication, EMI cron loan-state re-check.

**UI polish.**
- Home: suspended-account card now has an "Email support" CTA that
  opens a pre-filled `mailto:support@trustpe.in`.
- Settings: "Support" and "Report a security issue" rows are now
  tappable mailto links (was an Alert showing the email address).
- Login + KYC consent gate now use real DPDP-Act language and link to
  the in-app legal screens.

### Sprint 5G — copy + input audit + Sentry SDK wiring (✅ shipped)

**Copy audit — 11 user-visible fixes.**
- `[email protected]` placeholder on signup + login → `you@gmail.com`
  (was a real bug — literal template artifact from an earlier polish
  pass leaking through as the placeholder text).
- Home "Lend" tile: "Browse open requests and offer terms you're
  comfortable with" → "Browse open requests from people in your
  circle" (pre-fixed-rate era copy — you no longer offer terms).
- Home footer: deleted the "Agreement signing arrives in Sprint 2D.
  UPI disbursal and EMI payments in Sprint 3." dev-plan sentence —
  both features shipped ages ago.
- Chat empty state: dropped "Sprint 3 payment events will also post
  here automatically" → "payment updates will also appear here
  automatically".
- Fund confirmation footer: dropped "disburse via UPI in Sprint 3" →
  "then you disburse over UPI".
- Loan-requests amount input: dropped hint restating the placeholder
  range → kept only "Your TrustScore tier may cap this lower".
- Profile city input: dropped hint duplicating the PIN-code link
  below.
- Profile role/company placeholder: "e.g. Software Engineer, or your
  own" → "e.g. Software Engineer at Infosys" (awkward phrasing).
- Profile role/company hint: dropped redundant "Pick a suggestion or
  type your own".
- Reviews comment placeholder: dropped trailing "(optional)" since the
  section header already says OPTIONAL COMMENT.
- **Real bug** — Payments header: when you were the payee, it awkwardly
  said "You receive · <your own name> (<your own VPA>)". Now shows the
  payer's VPA on the receive side.
- Payments free-text inputs (failure reason, not-received reason) had
  empty labels → added explicit `accessibilityLabel` so TalkBack
  narrates "What went wrong?" / "What happened?" instead of silence.

**Sentry SDK wiring.** Backend `tracker.ts` and admin `tracker.ts`
swapped from TODO-stub to real `@sentry/node` and `@sentry/nextjs`
dynamic imports. Graceful degradation: if the package isn't installed
the tracker logs a warning and stays in stub mode — the app never
fails to boot. Backend `tracker.init()` is now async and awaited from
`server.ts`. Packages added to `backend/package.json` and
`admin/package.json`; run `bun install` at repo root when convenient.
Configure by setting `SENTRY_DSN` (backend) or `NEXT_PUBLIC_SENTRY_DSN`
(admin) in the environment.

### Sprint 5F — Render deploy blueprint (✅ shipped)

- **`render.yaml`** at the repo root — Blueprint that provisions both
  `trustpe-api` (Express + Socket.io) and `trustpe-admin` (Next.js) in
  Render's Singapore region. Secrets marked `sync: false` so they're
  pasted at deploy time; JWT secrets marked `generateValue: true` so
  Render generates strong random values. Admin's `NEXT_PUBLIC_API_BASE_URL`
  auto-wires to the API service via `fromService` — no manual URL entry
  when deploy URLs change. Health check path pinned to `/health/ready`
  so bad deploys auto-rollback.
- **`backend/Dockerfile`** — optional multi-stage Docker path. Not used
  by the Blueprint but kept for local reproducibility, alternative
  Docker hosts (Fly, Railway, EC2), and CI smoke builds. Uses a
  non-root user in the runtime stage and a wget-based HEALTHCHECK.
- **`.dockerignore`** — trims mobile/, docs/, .git/, IDE files from the
  Docker context.
- **`docs/DEPLOY_RENDER.md`** — Phase A (prereqs), Phase B (first
  Blueprint apply), Phase C (readiness verification), Phase D (custom
  domains + TLS + CORS + mobile API URL), Phase E (wiring mobile/admin
  at deployed API), Phase F (rollback, secret rotation, log tailing,
  free-tier sleep), Phase G (migration path — Phase 1 no-op),
  Phase H (failure-mode table for the deploys that go wrong).

### Sprint 5E — Production email delivery + OTP hardening (✅ shipped)

**Real transactional email.**
- `email.service` now uses a cached Resend client (lazy-loaded on first
  live send). Retries once on transient failures (5xx, DNS blip, connect
  timeout) with 750ms backoff; 4xx bubbles up so misconfigured senders
  fail loudly. Successful sends log to Pino; retried failures ship to
  the tracker.
- `EMAIL_FROM` and `EMAIL_REPLY_TO` env vars — sender address is no
  longer hard-coded to `noreply@trustpe.in`. `EMAIL_REPLY_TO` decouples
  the reply mailbox from the DKIM-verified sending domain.
- New `emailService.status()` returns `{live, from, replyTo}` for the
  readiness probe.

**Readiness probe.** `GET /health/ready` — 200 when DB is connected,
JWT secrets are set, Cloudinary is configured, and (in production) mail
is live. 503 otherwise, with a per-dependency `{ok, …}` breakdown so
operators can see what's missing at a glance. `GET /health/` is
unchanged as a bare liveness ping.

**OTP delivery failure surfacing.**
- `auth.service.signup` — if Resend send fails, roll back the OTP store
  entry (so the user's next attempt is clean, not "code expired") and
  return `502 otp_delivery_failed` with a user-safe message.
- `auth.service.login` — same rollback, but the failure is silent to the
  caller (returning it would confirm the email is registered — CWE-204
  info leak).
- Mobile signup + login screens now show a friendly inline error for
  `otp_delivery_failed` and a specific alert for `rate_limited`.

**Setup runbook.** `docs/PRODUCTION_EMAIL_SETUP.md` — Phase A Resend
signup, Phase B DNS verification (SPF + DKIM + DMARC), Phase C Render
env vars, Phase D readiness probe, Phase E send-yourself-an-OTP smoke
test, Phase F reputation warmup, Phase G key rotation and quota
management. Includes a failure-mode reference table for the common
"email not arriving" causes.

**`.env.example`** — cleaned up with pointers to the setup runbook and
the two new email vars.

### Sprint 5D — UTR guide, DPDP rights, accessibility (✅ shipped)

**UTR capture guide.** New `UtrGuideSheet` bottom-sheet component with
per-app step-by-step instructions for PhonePe, Google Pay, Paytm, and a
generic "search your bank SMS" fallback. Wired into the payment
confirmation form as "Where do I find my UTR? →" underneath the UTR
field. Steps use numbered accent badges and TalkBack-friendly expand /
collapse.

**DPDP §11–14 rights — export + delete.**
- `mePrivacyService.exportData(userId)` builds a portable JSON snapshot
  of the account, profile, KYC record (with a note pointing to
  privacy@trustpe.in for the actual document images — signed URLs would
  leak beyond their TTL), loans, requests, offers, reviews (given +
  received), notifications, and the audit slice touching the user.
- `mePrivacyService.deletionPrecheck(userId)` and `deleteAccount(userId,
  reason, ctx)` — precheck is non-mutating so the mobile UI can show
  what's blocking; deletion suspends the account, revokes every refresh
  token, invalidates every push token, and writes a
  `user.deletion_requested` audit row. Blocked (409, `live_loans`) when
  the user has any awaiting-agreement / awaiting-disbursal / active
  loan on either side.
- `GET /me/export`, `GET /me/deletion-precheck`, `POST /me/delete-account`
  routes under existing auth-required `/me` router.
- `mobile/app/(app)/settings/privacy.tsx` — new screen with the two
  actions. Export uses `expo-file-system.downloadAsync` + `expo-sharing`
  to save the JSON to the device and hand it to the OS share sheet.
  Delete uses a two-step confirm (info → type "DELETE" + optional
  reason) with a live blocking-loans callout when the precheck fails.
- `useAuth().getAccessToken()` — new helper exposing the current bearer
  token synchronously so file downloads can build their own fetch
  outside the standard `apiCall` path.

**Accessibility pass.**
- `Button` accepts optional `accessibilityLabel` and `accessibilityHint`
  for icon-only variants; still exposes `role="button"` and
  `state={busy,disabled}` for TalkBack.
- `TextInput` now sets `accessibilityLabel` to the visible label and
  `accessibilityHint` to the current error or hint text, so TalkBack
  reads the field even when the label scrolls out of view.
- Notification list rows are now buttons with a spoken "unread. Title.
  Body" label and a hint describing what tapping does.
- "Mark all N read" is now a labelled button with a `busy` state and a
  hit-slop bump for easier targeting.

### Sprint 5C — transactional emails + Play Store prep (✅ shipped)

**Email template polish.** New `backend/src/services/email-templates.ts`
provides a shared branded HTML scaffold (logo + body + footer with
privacy/terms/support links + preview-text snippet for Gmail/Apple Mail).
`email.service` now delegates to per-purpose renderers — `renderOtp`,
`renderKycApproved`, `renderKycClarification`, `renderKycRejected` —
each returning `{subject, html, text}` so plain-text variants are
covered for clients that prefer them. KYC decisions in
`admin-kyc.service` now fire both a push notification AND a templated
email after the transaction commits (fire-and-forget, never aborts the
decision flow).

**Play Store internal-track AAB prep.**
- `docs/PLAY_STORE_LAUNCH_CHECKLIST.md` — phased pre-flight + launch
  + post-launch tick-box runbook covering Developer Account setup,
  EAS keystore, asset prep, env / secrets, build commands, App Content
  forms, Data Safety, financial-features declaration, tester invites,
  72-hour monitoring, and a "common Play Console gotchas" reference.
- `docs/PLAY_STORE_LISTING.md` — ready-to-paste copy for every form:
  app name, taglines, full description (laundered through the
  closed-circle messaging — no "P2P" / "loans" / "investment" /
  "returns"), release notes (first build + template for subsequent),
  WhatsApp tester-invite template, App access reviewer instructions,
  Data Safety per-row answers, Financial-features exemption rationale,
  permissions justification, asset checklist with target paths.
- `mobile/app.json` — added `blockedPermissions` (location, contacts,
  SMS, call log — all explicitly off so transitive deps can't add them
  silently and trip Play's permissions review), added `expo-notifications`
  plugin, added `extra` block scaffolding for `eas.projectId`,
  `sentryDsn`, `apiBaseUrl` to be filled by EAS secrets at build time.
- `mobile/eas.json` — production profile now sets `autoIncrement:
  versionCode` and a base API URL env var; submit profile defaults to
  the Play Console `internal` track with `draft` release status (so
  you review before promoting).

### Beta prep (week 11)

- Production environment provisioned (Mongo Atlas paid M0, Render paid, Cloudinary upgraded if needed)
- Domain `trustpe.in` configured
- Production APK signed and uploaded to Expo internal distribution
- 5 invitees identified, invite codes generated
- Onboarding runbook for the founder (how to handle questions in WhatsApp / phone)
- Manual QA pass on production environment
- Bug fixes only — no new features

### Launch (week 12)

- Invite first 5 users
- Founder personally walks each through their first signup and first loan
- Daily check-ins for any issues
- Sentry monitoring
- Daily Maestro smoke runs on staging

### Test gate

- All pre-existing tests green
- Manual QA full checklist passed on production
- Sentry zero unresolved high-severity issues
- UptimeRobot 100% over the last 48 hours

### Sprint demo

5 users onboarded. At least one real loan disbursed and EMI paid. TrustScores in motion. Admin handled at least one edge case from real user.

### Exit criteria for Phase 1 (after the 8–12 weeks of operation post-launch)

- 30+ loans completed
- Default rate <12%
- Repayment-on-time rate >75%
- No security incident
- Founder confidence in product-market signal

If all met → kick off Phase 2 planning (DigiLocker, Aadhaar eSign, Cashfree, AA, iOS, Play Store, WhatsApp).

---

## 9. Definition of Done (every feature, every sprint)

A feature can be marked done in the sprint when ALL of these hold:

1. TypeScript strict-mode clean (no `any` without `// @reason:` comment)
2. Zod schema in `packages/core/schemas/` for any new data shape
3. Unit tests for any new domain logic (with named fixtures, not magic numbers)
4. Integration test for any new API endpoint covering happy path + at least one failure mode
5. Audit log entry written for any money-touching or KYC-touching state change
6. Adapter interface respected — no direct calls to Cashfree/Cloudinary/etc. from domain layer
7. Manual smoke test passed on real Android device for any RN screen
8. PR description references the spec section(s) it implements
9. Sentry breadcrumbs added for any complex flow
10. No new ESLint warnings introduced

---

## 10. Rituals

- **Sprint kickoff (Monday morning)**: read the sprint plan, confirm scope, identify the riskiest item, schedule the spike for it.
- **Mid-sprint check (end of week 1)**: am I on track? if not, what scope do I cut?
- **Sprint demo (Friday of week 2)**: record a 5-minute screen capture of the demoable outcome, save to `docs/sprint-demos/`.
- **Sprint retro (after demo)**: one-page note in `docs/sprint-retros/sprint-N.md`: what worked, what didn't, what to change next sprint.
- **Manual QA run before each demo**: tick through the relevant items in `TESTING.md` §6. Save run notes in `docs/qa-runs/YYYY-MM-DD.md`.

---

## 11. Scope-cut playbook

When a sprint is slipping (week 1 review shows behind schedule), cuts in this order:

1. **Defer non-critical admin features** — admin can use Mongo directly in a pinch.
2. **Defer polish** — empty states, animations, perfect copy.
3. **Defer secondary flows** — e.g., counter-offer can wait if accept-as-is works.
4. **Defer optional E2E tests** — keep unit and integration; cut some Maestro flows.
5. **Defer a feature entirely** — move to next sprint with a written note.

What we **never** cut:

- Audit logging
- Type safety
- Idempotency on money-touching paths
- Manual QA before demo
- The architecture's adapter pattern (no shortcuts that bypass the interface)

---

## 12. Out-of-sprint workstreams

Some things happen in parallel to the build, not inside any sprint:

- **Domain registration** (`trustpe.in`) — week 1.
- **WhatsApp Business onboarding** — start in Sprint 4 since 2–3 week Meta lead time and Phase 2 will need it ready.
- **Legal review of T&C and privacy policy** — start in Sprint 4 with a lawyer; budget ₹15,000–₹50,000.
- **Pilot user identification** — informal conversations starting Sprint 3 to line up 5 willing first users.
- **NBFC-P2P decision research** — ongoing across all sprints. By end of Phase 1, decide partner vs license.

---

## 13. Backlog (not in any current sprint)

Captured here so we don't lose them. These move into Phase 2 unless explicitly pulled forward:

- DigiLocker integration
- Aadhaar eSign via Digio
- Cashfree Penny Drop + UTR Recon
- Account Aggregator (Setu) integration
- Hyperverge selfie liveness
- Community vouching UI
- Public Next.js marketing site
- iOS React Native build
- Play Store submission
- SMS via MSG91
- WhatsApp Business templates
- CIBIL/Experian/CRIF pull
- UPI AutoPay / NPCI eMandate
- Refer-and-earn
- Hindi + Bengali UI
- Legal-notice automation
- Advanced fraud rules (device clustering, velocity, geo-anomaly)
