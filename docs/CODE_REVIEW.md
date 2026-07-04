# TrustPe Deep-Dive Code Review — 2 July 2026

> **STATUS: APPLIED.** All Section 3 fixes plus HR-1 (admin httpOnly cookie), HR-2 (Idempotency-Key middleware + mobile headers), and HR-4 (expiry sweep job) were applied on 2 July 2026. HR-3 (consolidating duplicated EMI math) was deliberately skipped — it risks changing agreement `bodyHash` determinism; revisit alongside the PDF work. Run `npm run typecheck && npm test` in backend/shared before deploying (sandbox was unavailable during the session, so changes are desk-checked only). New index deploy note: `uniq_open_request_per_borrower` and `uniq_open_intent_per_loan_kind_emi` build on boot — verify no existing data violates them first.

Scope: backend (91 files), shared (26), mobile (77), admin (19). Focus: edge cases, races, security, architecture, duplication, performance. All proposed fixes are backward compatible with the current mobile/admin clients unless flagged **HIGH-RISK**.

---

## 1. Executive Summary

The codebase is in better shape than most pilot-stage projects: layering discipline (controller → service → model) is consistently followed, Zod schemas are genuinely shared across all three consumers, refresh-token rotation with theft detection is correctly implemented, and the `fund()` flow uses a proper atomic conditional update.

The problems cluster in four areas:

1. **Missing abuse protection** — there is no rate limiting anywhere. The OTP auth surface is brute-forceable and spammable.
2. **Read-then-write races on money paths** — attestation, agreement signing, intent creation, and request creation all have TOCTOU windows. The CLAUDE.md-mandated `Idempotency-Key` middleware does not exist.
3. **Silent production bugs** — push notifications permanently die after logout/login on the same device; EMI rounding loses/creates paise; offline app launch logs the user out and destroys their refresh token; the admin panel force-logs-out every 15 minutes.
4. **Lifecycle gaps** — `expiresAt` exists on loan requests and payment intents but nothing enforces it; expired requests remain fundable.

Nothing here requires changing any API contract, response shape, or screen. Every fix below is additive or internal.

---

## 2. Issue Log

### A. Edge cases, races, security

| # | Sev | Issue | Where |
|---|-----|-------|-------|
| A1 | **Critical** | No rate limiting on any endpoint. `/auth/login` + `/auth/signup` let anyone flood arbitrary emails with OTPs; OTP verify allows 5 guesses per code but unlimited fresh codes; no per-IP throttle anywhere. | `app.ts`, `auth.routes.ts` |
| A2 | **Critical** | Push notifications permanently break after logout→login on the same device. `unregisterToken` sets `invalidatedAt`; `registerToken` tries to clear it with `$set: { invalidatedAt: undefined }`, which Mongoose silently drops. The send filter is `invalidatedAt: { $exists: false }`, so the token is excluded forever. | `notification.service.ts:220` |
| A3 | **High** | `submitAttestation` race: two concurrent attestations (or a double-tap) both read `status='payer_confirmed'` and both run the verified side-effects — double `markEmiPaid`, double loan-close audit. `markEmiPaid` has no already-paid guard either. | `payment.service.ts:452`, `emi.service.ts:141` |
| A4 | **High** | `agreement.sign` race: both parties signing concurrently each read the doc before the other's signature lands → both take the "partial" branch → agreement ends `awaiting_lender`/`awaiting_borrower` with **both signatures present** and the loan stuck in `awaiting_agreement` forever. The doc is loaded *outside* the session, so the transaction gives no protection. | `agreement.service.ts:239–312` |
| A5 | **High** | TOCTOU on intent creation: `initiateDisbursal`/`initiateEmiPayment` do `findOne(open intent)` then `create` — concurrent calls create duplicate open intents. No partial unique index backs the invariant. Same pattern for "one open request per borrower" in `loanRequestService.create`. | `payment.service.ts:175,271`, `loan-request.service.ts:123` |
| A6 | **High** | `Idempotency-Key` middleware mandated by CLAUDE.md ("every money-touching endpoint") does not exist; no `middleware/idempotency.ts` anywhere. | `backend/src/middleware/` |
| A7 | **High** | `expiresAt` is never enforced. Expired loan requests stay `'open'`: still visible in browse, still fundable. Expired payment intents still accept payer evidence/attestation. No sweep job exists. | `loan-request.service.ts:search`, `loan-offer.service.ts:fund`, `payment.service.ts` |
| A8 | **High** | Admin refresh token lives in `localStorage` (XSS-exfiltratable). Backend comments claim "admin web uses httpOnly refresh cookie" but no cookie is ever set — the flow was never implemented. | `admin/src/lib/auth-context.tsx:28`, `backend/src/app.ts:45` |
| A9 | Med | `clientIp()` manually parses the *leftmost* `X-Forwarded-For` entry, which the client controls. With `trust proxy` already set, this lets users forge the IP recorded in audit logs and **agreement signatures** (legal evidence). | `utils/request-context.ts:21` |
| A10 | Med | `writeAudit` swallows failures even when called **inside a money transaction** — a loan can activate/close with no audit row, violating engineering principle #4. | `utils/audit.ts:57` |
| A11 | Med | Socket.io CORS is `origin: '*'` (marked "locked down later"). Config already has `CORS_ORIGINS`. | `socket/index.ts:28` |
| A12 | Med | `fund()` never re-checks the **borrower's** eligibility. A borrower suspended (or KYC-revoked) after publishing can still be funded. | `loan-offer.service.ts:140` |
| A13 | Med | Mobile: `refreshSession` clears the session — including deleting the stored refresh token — on *any* error, including network failures. Launching the app in airplane mode logs the user out permanently. | `mobile/lib/auth-context.tsx:149–156` |
| A14 | Med | Admin panel force-logs-out every ~15 min: any 401 (expired access token) triggers `_onAuthFail` → redirect to /login, with no refresh-and-retry, despite the file comment claiming "auto-refresh on 401 is handled here". | `admin/src/lib/api.ts:85` |
| A15 | Low | Graceful shutdown calls `process.exit(0)` before `server.close()` finishes — in-flight requests are cut, and a second SIGTERM re-runs shutdown. | `server.ts:33–41` |
| A16 | Low | Re-signup with an existing email but different phone/name silently ignores the new phone/name (sends OTP as if login). Probably fine, but undocumented. | `auth.service.ts:60` |

### B. Money-math

| # | Sev | Issue |
|---|-----|-------|
| B1 | **High** | EMI rounding drift: `monthly = round(totalAmount/tenure)` means `monthly × tenure ≠ totalAmount` (e.g. ₹10,000 @ 24% × 5 months: total ₹11,000, monthly ₹2,200 ✓ — but ₹7,000 @ 22% × 3 months: total interest ₹385, total ₹7,385, monthly ₹2,462 → ×3 = ₹7,386, borrower overpays ₹0.01… and with other inputs underpays). Also `principalPerEmi + interestPerEmi ≠ monthly` in general, so the per-installment breakdown doesn't sum. The agreement quotes the same drifting number. Last installment must absorb the remainder. (`emi.service.ts:80–99`) |
| B2 | Med | A disputed EMI intent doesn't block a *new* intent for the same EMI (retry is intended), but if admin later verifies the disputed one **and** the new one is verified, `markEmiPaid` silently double-marks — no already-paid guard (ties into A3). |

### C. Design & architecture

| # | Issue |
|---|-------|
| C1 | `loanToPayload` is copy-pasted in `loan.service.ts` and `loan-offer.service.ts` — two payload shapes to keep in sync by hand. |
| C2 | Simple-interest math is implemented twice on the backend (`agreement.service.ts:emiCalc` and `emi.service.ts:generateForLoan`) and again on mobile. If one changes, the agreement document and the actual schedule disagree — on a *legal document*. |
| C3 | `formatRupees` duplicated in `agreement.service.ts`, `emi-reminder.job.ts`, and inlined ~8 times in `payment.service.ts`. |
| C4 | `Types.ObjectId.isValid(...) → AppError('invalid_id')` boilerplate repeated in ~15 service methods — belongs in one helper or a params-validation middleware (note: `validate.ts` already declares `params` in its type but ships no `validateParams`). |
| C5 | `payment.controller.ts` re-parses schemas already validated by the route (`req.validated?.body ?? schema.parse(req.body)`) — two validation paths that can drift. Every controller also re-checks `if (!req.user)` after `requireAuth` already guaranteed it. |
| C6 | Cursor pagination is broken for `amount_asc`/`amount_desc` sorts: the cursor filters on `_id` but the sort is on `amountPaise`, so pages skip/duplicate rows whenever amounts don't correlate with insertion order. (`loan-request.service.ts:343`) |
| C7 | JWT fallback expiry hard-codes `15 * 60` regardless of `JWT_ACCESS_TTL`. (`utils/jwt.ts:32`) |
| C8 | `reviewService.submit` mutates `reviewee.trustScore` on a doc loaded *outside* the session, then saves inside it — concurrent reviews last-write-wins the score. Should be `$inc` + clamp, or a session-fresh read. |
| C9 | `initiateEmiPaymentSchema` hard-codes `.max(6)` instead of `MAX_LOAN_TENURE_MONTHS`. |

### D. Duplication, dead code, performance

| # | Issue |
|---|-------|
| D1 | `admin.service.ts` (8 lines) and `admin.controller.ts` (7 lines) appear to be dead stubs — nothing routes to them (`admin.routes.ts` uses admin-kyc/dispute/user controllers). Verify and delete. |
| D2 | `emi-reminder.job.ts` N+1: it fetches all active loan `_id`s, then re-fetches each full loan inside the loop (`Loan.findById(schedule.loanId)`). One `Loan.find({...})` + a Map removes the N+1. Notifications are also awaited serially. |
| D3 | `database.ts` header comment says "Sprint 0: stub — not called yet"; it's been wired into boot for several sprints. CLAUDE.md also says the idempotency middleware exists "(added in Sprint 3)" — it doesn't. Stale docs cost future-you real time. |
| D4 | Mobile socket: `reconnectionAttempts: Infinity` with a token that expires in 15 min → if the socket drops after expiry, it retries forever with a dead token until the next API-triggered refresh. Low impact, worth a `connect_error`-triggered refresh hook later. |
| D5 | Hot list endpoints (`browse`, `notifications`, `loans/mine`) hydrate full Mongoose docs only to map to plain payloads — add `.lean()` for free wins when user counts grow. Not urgent at 30–50 users. |

---

## 3. Actionable Fixes (safe — no UI/contract change)

### FIX A2 — resurrect push tokens (1-line, do this first)

`backend/src/services/notification.service.ts`, in `registerToken`, replace the update object:

```ts
await PushToken.findOneAndUpdate(
  { token },
  {
    $set: { userId, platform, lastSeenAt: new Date() },
    $unset: { invalidatedAt: 1 },
  },
  { upsert: true, new: true },
);
```

### FIX A1 — rate limiting

`npm i express-rate-limit` (backend). New file `backend/src/middleware/rate-limit.ts`:

```ts
/**
 * Rate limiters — in-memory (single-process Render free tier, same rationale
 * as otp-store.service.ts). Swap store for Redis in Phase 3.
 */
import rateLimit from 'express-rate-limit';

const rateLimitedBody = {
  ok: false,
  error: { code: 'rate_limited', message: 'Too many requests. Please try again later.' },
};

/** OTP issuance (signup/login): 5 per email per 15 min, 20 per IP per 15 min. */
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => String((req.body as { email?: string })?.email ?? req.ip).toLowerCase(),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitedBody,
});

export const otpRequestIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitedBody,
});

/** OTP verification: 10 attempts per IP per 15 min (each OTP already caps at 5). */
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitedBody,
});

/** General API guard: 300 req / 15 min / IP. Generous — protects against loops. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitedBody,
});
```

`auth.routes.ts` — insert limiters *before* validation:

```ts
authRouter.post('/signup', otpRequestIpLimiter, otpRequestLimiter, validateBody(signupSchema), authController.signup);
authRouter.post('/login', otpRequestIpLimiter, otpRequestLimiter, validateBody(loginSchema), authController.login);
authRouter.post('/verify-otp', otpVerifyLimiter, validateBody(verifyOtpSchema), authController.verifyOtp);
```

Optionally `app.use(apiLimiter)` in `app.ts` after `trust proxy`. Existing clients see no change unless they exceed limits (429 with the standard error envelope, which both clients already parse).

### FIX A3 + B2 — atomic attestation claim + already-paid guard

`payment.service.ts`, `submitAttestation` — replace the mutate-and-save with an atomic conditional claim inside the transaction:

```ts
const before = { status: intent.status };
const session = await startSession();
try {
  await session.withTransaction(async () => {
    const attestation = {
      decision: input.decision,
      reason: input.reason,
      submittedAt: new Date(),
      ip: ctx.ip,
    };
    const nextStatus = input.decision === 'not_received' ? 'disputed' : 'verified';

    // Atomic claim: only one caller can move payer_confirmed → next state.
    const fresh = await PaymentIntent.findOneAndUpdate(
      { _id: intent._id, status: 'payer_confirmed' },
      {
        $set: {
          status: nextStatus,
          receiverAttestation: attestation,
          ...(nextStatus === 'verified' ? { verifiedAt: new Date() } : {}),
        },
      },
      { new: true, session },
    );
    if (!fresh) {
      throw new AppError('wrong_intent_state', 'This payment was already attested.', 409);
    }
    // Keep the in-memory doc in sync for toPayload() after the transaction.
    intent.set(fresh.toObject());

    if (nextStatus === 'verified') {
      const loan = await Loan.findById(fresh.loanId).session(session);
      if (!loan) throw new AppError('loan_not_found', 'Loan vanished', 404);
      if (fresh.kind === 'disbursal') {
        await applyVerifiedDisbursal(loan, fresh, ctx, session);
      } else if (fresh.kind === 'emi') {
        await applyVerifiedEmi(loan, fresh, ctx, session);
      }
    }

    await writeAudit(ctx, { /* unchanged */ }, session);
  });
} finally {
  await session.endSession();
}
```

`emi.service.ts`, `markEmiPaid` — guard double-settlement:

```ts
if (installment.status === 'paid') {
  // Already settled (e.g. a disputed intent verified by admin after a retry
  // intent also verified). Do not overwrite the original settlement pointer.
  return schedule;
}
installment.status = 'paid';
```

### FIX A4 — agreement signing race

`agreement.service.ts`, `sign` — load a session-fresh doc inside the transaction and operate on that (transactional reads on the same doc produce WriteConflict on contention, which `withTransaction` auto-retries — the retry then sees the other signature):

```ts
const session = await startSession();
try {
  let result!: AgreementDocument;
  await session.withTransaction(async () => {
    const fresh = await Agreement.findById(agreement._id).session(session);
    if (!fresh) throw new AppError('agreement_not_found', 'Agreement vanished', 404);
    if (fresh.status === 'signed') { result = fresh; return; }        // other party won the race
    if (fresh.status === 'void') throw new AppError('agreement_void', 'This agreement has been voided.', 409);
    if (role === 'borrower' && fresh.borrowerSignature) { result = fresh; return; }
    if (role === 'lender' && fresh.lenderSignature) { result = fresh; return; }

    if (role === 'borrower') fresh.borrowerSignature = signature;
    else fresh.lenderSignature = signature;

    const bothSigned = Boolean(fresh.borrowerSignature && fresh.lenderSignature);
    if (bothSigned) {
      fresh.status = 'signed';
      fresh.signedAt = new Date();
      const loan = await Loan.findById(fresh.loanId).session(session);
      if (loan && loan.status === 'awaiting_agreement') {
        const before = { status: loan.status };
        loan.status = 'awaiting_disbursal';
        await loan.save({ session });
        await writeAudit(ctx, { action: 'loan.agreement_signed', entityType: 'loan',
          entityId: String(loan._id), before, after: { status: loan.status } }, session);
      }
    } else {
      fresh.status = role === 'borrower' ? 'awaiting_lender' : 'awaiting_borrower';
    }

    await fresh.save({ session });
    await writeAudit(ctx, { /* agreement.signed entry, unchanged */ }, session);
    result = fresh;
  });
  // …existing chat/notification block, but reading `result` instead of `agreement`…
  return toPayload(result);
} finally {
  await session.endSession();
}
```

Also add a one-time **repair check** for any already-stuck agreement (both signatures present, status ≠ signed) before deploying.

### FIX A5 — partial unique indexes (DB-level invariants)

`PaymentIntent.ts` (after the existing indexes):

```ts
// At most ONE open intent per (loan, kind, emiNumber). Backs the findOne-
// then-create in payment.service against concurrent initiations.
paymentIntentSchema.index(
  { loanId: 1, kind: 1, emiNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['awaiting_payer_evidence', 'payer_confirmed'] } },
    name: 'uniq_open_intent_per_loan_kind_emi',
  },
);
```

`LoanRequest.ts`:

```ts
// At most ONE open request per borrower — DB-level backup for the service check.
loanRequestSchema.index(
  { borrowerId: 1 },
  { unique: true, partialFilterExpression: { status: 'open' }, name: 'uniq_open_request_per_borrower' },
);
```

Then wrap the two `create` calls to translate `E11000` into the same friendly 409 the pre-check already produces (`code === 11000 → AppError('open_request_exists' | reuse-existing-intent)`). Run a pre-deploy check that no data currently violates these (at pilot scale, trivially fast).

### FIX A7 — enforce expiry (no cron needed yet)

- `loan-request.service.ts:search` filter: add `expiresAt: { $gt: new Date() }`.
- `loan-offer.service.ts:fund` conditional claim: `{ _id: requestId, status: 'open', expiresAt: { $gt: new Date() } }` — and the pre-check: `if (request.expiresAt < new Date()) throw new AppError('request_expired', 'This request has expired.', 409)`.
- `payment.service.ts:submitPayerEvidence` / `submitPayerFailure`: reject when `intent.expiresAt < new Date()` with `AppError('intent_expired', …, 409)`. Leave attestation unrestricted (money may already have moved).

Old records simply stop being fundable — no client change.

### FIX B1 — EMI rounding (last installment absorbs remainder)

`emi.service.ts`, `generateForLoan` — replace the per-EMI constants + loop:

```ts
const totalInterest = Math.round((principal * loan.roiPercent * tenure) / (100 * 12));
const totalAmount = principal + totalInterest;
const monthly = Math.round(totalAmount / tenure);

const principalPerEmi = Math.floor(principal / tenure);
const interestPerEmi = Math.floor(totalInterest / tenure);

const installments = [];
for (let i = 1; i <= tenure; i++) {
  const isLast = i === tenure;
  // Last EMI absorbs all rounding remainders so the schedule sums EXACTLY
  // to principal + totalInterest. See TESTING.md money-invariant tests.
  const principalPaise = isLast ? principal - principalPerEmi * (tenure - 1) : principalPerEmi;
  const interestPaise = isLast ? totalInterest - interestPerEmi * (tenure - 1) : interestPerEmi;
  installments.push({
    emiNumber: i,
    dueDate: addMonths(disbursedAt, i),
    principalPaise,
    interestPaise,
    amountPaise: principalPaise + interestPaise,
    status: 'pending' as const,
  });
}
```

Invariant: `Σ amountPaise === totalAmount` exactly. Only affects **newly generated** schedules; existing ones untouched. `monthlyAmountPaise` snapshot stays as the display value (matches all but the last EMI). Add a unit test asserting the invariant across a grid of (amount, roi, tenure). The agreement text already says "monthly EMI of ≈monthly" — unchanged clients render identically; consider Phase-2 wording "final instalment may differ by a few paise".

### FIX A9 — stop trusting client-supplied XFF

`utils/request-context.ts`:

```ts
export function clientIp(req: Request): string | undefined {
  // `trust proxy` is configured in app.ts, so req.ip already resolves the
  // correct client address from X-Forwarded-For. Never parse the header
  // manually — the leftmost entry is attacker-controlled.
  return req.ip ?? req.socket.remoteAddress ?? undefined;
}
```

### FIX A10 — audit must abort money transactions

`utils/audit.ts` — fail loudly when a session is present:

```ts
export async function writeAudit(ctx, entry, session?: ClientSession): Promise<void> {
  try {
    await AuditLog.create([ /* unchanged doc */ ], session ? { session } : {});
  } catch (err) {
    if (session) {
      // Inside a money/identity transaction the audit row is part of the
      // atomic unit — failing to write it must abort the whole transition.
      // See CLAUDE.md "Audit everything that touches money or identity".
      throw err;
    }
    logger.error({ err, entry }, 'Failed to write audit log entry');
  }
}
```

Non-transactional callers keep today's best-effort behavior.

### FIX A11 — socket CORS

`socket/index.ts`:

```ts
import { env } from '../config/env.js';
// …
const io = new IoServer(httpServer, {
  cors: { origin: env.CORS_ORIGINS, credentials: true },
  transports: ['websocket', 'polling'],
});
```

Note: RN socket connections don't send an Origin header, so the mobile app is unaffected; this only locks out browser-based origins.

### FIX A12 — re-check borrower at fund time

`loan-offer.service.ts`, in `fund()` after `borrowerSnap` is loaded:

```ts
const borrowerElig = eligibilityService.forBorrow(borrowerSnap.user);
if (!borrowerElig.ok) {
  throw new AppError(
    'borrower_not_eligible',
    'The borrower is no longer eligible to receive this loan.',
    409,
  );
}
```

### FIX A13 — mobile: don't destroy the session on network errors

`mobile/lib/auth-context.tsx`, `refreshSession` catch block:

```ts
} catch (err) {
  // Only a definitive auth rejection should destroy the stored refresh
  // token. Network failures / server 5xx keep the session for next launch.
  const isAuthRejection =
    err instanceof ApiError && (err.status === 401 || err.status === 404);
  // eslint-disable-next-line no-console
  console.warn('[auth] refresh failed', err);
  if (isAuthRejection) await clearLocalSession();
  return false;
}
```

(Offline launch now lands on the logged-out screen for this session but recovers on next online launch — same UI, no flow change.)

### FIX A14 — admin: refresh-and-retry instead of instant logout

`admin/src/lib/api.ts` — add an injectable refresh hook and one retry:

```ts
let _refreshFn: (() => Promise<boolean>) | null = null;
export function setRefreshFn(fn: (() => Promise<boolean>) | null): void {
  _refreshFn = fn;
}
```

In `apiRequest`, replace the `!res.ok` 401 branch (extract the existing fetch body into `doFetch()` so it can run twice):

```ts
if (!res.ok) {
  if (res.status === 401 && !opts._retried) {
    const refreshed = _refreshFn ? await _refreshFn().catch(() => false) : false;
    if (refreshed) return apiRequest<T>({ ...opts, _retried: true } as typeof opts);
    if (_onAuthFail) _onAuthFail();
  } else if (res.status === 401 && _onAuthFail) {
    _onAuthFail();
  }
  // …existing ApiError throw…
}
```

(`_retried?: boolean` added to the opts type.) In `auth-context.tsx`, wire it next to the existing `setOnAuthFail`:

```ts
useEffect(() => {
  setRefreshFn(refreshSession);
  return () => setRefreshFn(null);
}, [refreshSession]);
```

Also add in-flight de-duplication to `refreshSession` (mirror the mobile `refreshInFlight` ref) so a burst of parallel 401s shares one refresh — otherwise the second refresh replays the just-rotated token and **trips your own theft detection**, killing the chain.

### FIX C6 — cursor pagination for amount sorts

`loan-request.service.ts` — compound cursor `(amountPaise, _id)` when sorting by amount:

```ts
if (query.cursor) {
  const [rawSecondary, rawId] = query.cursor.includes('_')
    ? (query.cursor.split('_') as [string, string])
    : [null, query.cursor];
  if (!rawId || !/^[0-9a-fA-F]{24}$/.test(rawId)) {
    throw new AppError('invalid_cursor', 'Cursor is not a valid id', 400);
  }
  const id = new Types.ObjectId(rawId);
  const dir = sortDirection(query.sort);
  if ((query.sort === 'amount_asc' || query.sort === 'amount_desc') && rawSecondary !== null) {
    const amt = Number(rawSecondary);
    filter.$or = [
      { amountPaise: dir === 1 ? { $gt: amt } : { $lt: amt } },
      { amountPaise: amt, _id: dir === 1 ? { $gt: id } : { $lt: id } },
    ];
  } else {
    filter._id = dir === 1 ? { $gt: id } : { $lt: id };
  }
}
```

And emit the matching cursor:

```ts
const last = pageItems[pageItems.length - 1];
const nextCursor = !hasMore || !last ? null
  : query.sort === 'amount_asc' || query.sort === 'amount_desc'
    ? `${last.amountPaise}_${String(last._id)}`
    : String(last._id);
```

Backward compatible: the cursor is opaque to clients; old plain-id cursors still parse via the fallback branch.

### FIX A15 — orderly shutdown

`server.ts`:

```ts
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutdown signal received');
  stopBackgroundJobs(jobs);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  logger.info('HTTP server closed');
  await disconnectDatabase();
  process.exit(0);
}
```

### FIX D2 — de-N+1 the reminder job

`emi-reminder.job.ts`:

```ts
const activeLoans = await Loan.find({ status: 'active' }); // full docs, one query
if (activeLoans.length === 0) return;
const loanById = new Map(activeLoans.map((l) => [String(l._id), l]));
const schedules = await EmiSchedule.find({ loanId: { $in: activeLoans.map((l) => l._id) } });
// …inside the loop:
const loan = loanById.get(String(schedule.loanId));
if (!loan) continue;
```

### Small cleanups

- `payment.controller.ts`: drop the `?? schema.parse(req.body)` fallbacks — routes always validate; keep `req.validated?.body as X`.
- `shared/schemas/payment.ts`: `emiNumber: z.number().int().min(1).max(MAX_LOAN_TENURE_MONTHS)`.
- `utils/jwt.ts`: derive the fallback from a shared constant or accept the decode value only (`throw` if `exp` missing — it never will be with `expiresIn` set).
- Delete `admin.service.ts` / `admin.controller.ts` after confirming nothing imports them.
- Fix the stale comments (`database.ts` "Sprint 0 stub", `app.ts` "httpOnly refresh cookie", CLAUDE.md idempotency claim) — or implement the cookie flow (see HR-1).
- `review.service.ts`: replace `reviewee.save({ session })` with
  `User.updateOne({ _id: reviewee._id }, [{ $set: { trustScore: { $max: [300, { $min: [900, { $add: ['$trustScore', scoreDelta] }] }] } } }], { session })` + recompute band, or re-read the user inside the session.

---

## 4. HIGH-RISK REFACTORS — need your go-ahead

**HR-1. Admin refresh token → httpOnly cookie (A8).**
Backend sets/reads a `refreshToken` cookie on `/auth/verify-otp`, `/auth/refresh`, `/auth/logout` (the controller already *reads* the cookie — only the Set-Cookie side is missing); admin client stops touching `localStorage`. Requires `CORS_ORIGINS` + `credentials` verification and a session-migration moment for logged-in admins (they'll re-login once). Touches auth controller + admin auth-context. Mobile unaffected (body path preserved).

**HR-2. `Idempotency-Key` middleware (A6).**
New `middleware/idempotency.ts` (Mongo-backed key + response-hash store, 24 h TTL) applied to `/disburse`, `/emi-payments`, `/payer-evidence`, `/attestation`, `/loan-requests/:id/offers`. Server-side it's purely additive (header optional at first), but doing it *right* means the mobile app starts sending UUIDs — a coordinated change across backend + mobile.

**HR-3. Consolidate the duplicated money math + payload mappers (C1–C3).**
Move `emiCalc`/schedule math into `shared/` (single source used by agreement text, schedule generation, and the mobile fund-confirmation card), plus one `loanToPayload`. Mechanical but touches many files; byte-identical outputs must be verified against existing agreement hashes (regenerating body text differently would change `bodyHash` — hence high-risk).

**HR-4. Expiry sweep job.**
A cron that transitions stale `open` requests → `expired` and stale intents → `expired`, with audit rows. New writer to money-adjacent collections, so gated on your approval; FIX A7 above already closes the exploitable gap without it.

---

*Verification notes: the sandbox VM was unavailable this session, so fixes were desk-checked against the actual source but not compiled/tested. Each fix should land with its unit test (EMI-sum invariant, attestation double-fire, agreement concurrent sign, rate-limit 429 envelope) per TESTING.md.*
