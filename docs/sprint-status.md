# TrustPe — Sprint Status

Lightweight running log of where each sprint stands. Updated at sprint start, mid-sprint, and end.

---

## Sprint 0 — Foundation

**Status:** in progress
**Week:** 1
**Started:** 2026-05-26

### Done

- [x] Root config: `package.json`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`, `.editorconfig`, `.prettierrc`, `.prettierignore`, `.eslintrc.cjs`, `.env.example`
- [x] `docker-compose.yml` (Mongo replica-set + Redis + Mongo Express)
- [x] `README.md`, `CLAUDE.md`, `.cursorrules`
- [x] `docs/ARCHITECTURE.md` v0.6
- [x] `docs/TESTING.md`
- [x] `docs/BUILD_PLAN.md`
- [x] `docs/dev-runbook.md`
- [x] `shared/` folder (zod schemas index, TS types, constants, vitest smoke test)
- [x] `backend/` MVC scaffold (server.ts, app.ts, config/env+database, utils/logger, middleware/error-handler+not-found, routes/index+health, controllers/health, integration test)
- [x] `mobile/` Expo skeleton with `@shared/*` resolution via babel + metro + tsconfig
- [x] `admin/` Next.js skeleton with `@shared/*` resolution via webpack + tsconfig
- [x] `.github/workflows/ci.yml`

### To do this sprint

- [ ] **One-time cleanup**: delete leftover `apps/` and `packages/` folders manually (sandbox couldn't delete them; see `docs/dev-runbook.md` §0)
- [x] Run `bun install` once at the repo root (workspaces install all four folders together)
- [ ] Run `bun run typecheck` (root) and confirm green
- [ ] Run `bun run test` (root) and confirm green
- [ ] Boot `bun run dev:backend` and curl `http://localhost:4000/health`
- [ ] Boot `bun run dev:admin` and load `http://localhost:3001`
- [x] Boot `bun run dev:mobile` and load on a device — placeholder screen renders in Expo Go SDK 54
- [ ] **UPI Intent spike**: prototype native UPI Intent integration on real Android device. Fire `upi://pay` Intent to GPay with ₹1, capture the return string, log it. De-risks Sprint 3.
- [ ] Run first CI on a commit; confirm all jobs green

### Demo (end of Sprint 0)

Show: each app boots locally. `/health` returns OK from the backend. Admin loads at :3001. Mobile loads in Expo Go. UPI Intent spike returns parsed result on real Android device.

### Notes / blockers

- The previous scaffold's `apps/` and `packages/` folders still exist on disk because the cowork sandbox can't delete them. Manual delete on your Windows file system clears them — see runbook §0.
- Bun + Expo on Windows: if `bun expo ...` misbehaves, fall back to `bunx expo ...` or `npx expo ...`. Both work since `bun.lockb` is checked in per app.
- The UPI Intent spike is the single most important remaining de-risk task. Do it before Sprint 1 starts.

### Resolved issues (Sprint 0)

- Bun workspaces wiring corrected (single `bun install` at root)
- Script flag order fixed (`bun run --cwd X dev`, not `bun --cwd X run dev`)
- Mobile upgraded SDK 51 → SDK 54 to match Expo Go (React 19.1 + RN 0.81)
- NativeWind removed from Sprint 0 (deferred to Sprint 1 with full config)
- Canonical Expo monorepo Metro config applied to fix duplicate-React error

---

## Sprint 1 — Auth + Profile + KYC (UPI bound inside KYC)

**Status:** complete
**Closed:** 2026-06-06

### Delivered

- Email-OTP auth: signup, verify-otp, refresh, logout, /me. Refresh token rotation with theft detection. Access-token auto-refresh on mobile via auth-context.
- Profile setup: city autocomplete (full India districts + PIN-code lookup with Zippopotam primary / postalpincode.in fallback), occupation + role autocompletes, income band.
- KYC capture: tappable preview-area UX, expo-camera-based 5-second selfie recorder (cross-platform duration enforcement), Cloudinary signed-upload from mobile. Aadhaar Act §29 compliance — no Aadhaar number collected.
- KYC submission also captures payment binding (UPI ID) — single onboarding step, no separate UPI flow.
- Admin KYC review: queue + detail page with documents grid, free UIDAI Aadhaar verification panel, free NPCI UPI name-lookup verification panel (Copy button → paste into your UPI app). Approve / Reject / Request clarification with audit-logged transactions.
- Mobile home: auto-polls `/me` every 15s while `pending_review`; AppState foreground refetch; one-shot Alert on transition out of pending_review.
- Sprint 1 architectural refactor: merged the originally-planned standalone UPI registration into the KYC step after discovering free NPCI name-lookup beats screenshot-OCR for verification. See `docs/ONBOARDING_FLOW.md` §8.

### Deferred to later sprints

- Push notifications (Expo Push token + backend storage) — batched with Sprint 4 notifications.
- Admin user-detail page + audit log viewer — quality-of-life, non-blocking.

### Test gate

- Manual end-to-end exercised: signup → OTP → profile → KYC submit → admin approve → home flips to "You're all set" within 15s.
- Automated unit + integration suite per `docs/TESTING.md` §4 still to be added (carried into Sprint 2 prep).

---

## Sprint 2 — Loan request, offer, negotiation, agreement

**Status:** not started
**Planned start:** Week 4

See `docs/BUILD_PLAN.md` §5.

---

## Sprint 3 — UPI payment + lifecycle + EMI

**Status:** not started
**Planned start:** Week 6

See `docs/BUILD_PLAN.md` §6.

---

## Sprint 4 — TrustScore + Reviews + Disputes + Notifications

**Status:** not started
**Planned start:** Week 8

See `docs/BUILD_PLAN.md` §7.

---

## Sprint 5 — Polish + Closed Beta launch

**Status:** not started
**Planned start:** Week 10

See `docs/BUILD_PLAN.md` §8.
