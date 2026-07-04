# TrustPe — Master Architecture Document

**Version:** 0.6.0-draft
**Status:** Awaiting approval before code generation
**Owner:** Bhagirath
**Last updated:** 2026-05-25
**Document set:** `ARCHITECTURE.md` (this file) • `SCHEMAS.md` • `API_DESIGN.md` • `ENGINES.md` • `FOLDER_STRUCTURE.md`

> **Changes since v0.5.0 (MAJOR)**
> - **Phase 1 user app is now React Native (Expo) Android**, not Next.js PWA. This unlocks **native UPI Intent Result handling** as the primary payment-confirmation path — fully automatic, no screenshot needed on the happy path. UPI app returns `Status=SUCCESS&txnRef=<12-digit-UTR>&Amount=15000.00&...` to TrustPe directly via Android Intent.
> - Screenshot + OCR moves to **fallback role** (used only when Intent return is incomplete or for diagnostic / dispute evidence).
> - Public Next.js user website **dropped from Phase 1** (not needed for invite-only friends pilot). Admin panel stays as Next.js.
> - iOS deferred to **Phase 2** (one-shot RN code share when we get there).
> - Phase 1 distribution: **direct APK via Expo internal distribution** (no Play Store yet); Play Store launch is Phase 2.
> - Push notifications via **Expo Push Service** (free, FCM under the hood). Biometric auth available via Expo LocalAuthentication.
> - Token storage: **Expo SecureStore** (encrypted, Keystore-backed) instead of httpOnly cookies.
> - New Phase 1 stack: `apps/mobile/` (RN Expo) + `apps/admin/` (Next.js) + `apps/api/` (Express) + `packages/core/` (shared TS/Zod).
>
> **Changes from v0.4.0 → v0.5.0** (carried forward)
> - Payment verification is **asymmetric**: payer uploads evidence (now: native Intent result; fallback: screenshot+OCR); receiver attests with single tap. 24h retraction window. Per-UPI-app capture guides for fallback path.
> - `IPaymentVerificationProvider` split into `submitPayerEvidence` + `submitReceiverAttestation`.
>
> **Changes from v0.3.0 → v0.4.0** (carried forward)
> - Phase 1 verification now **OCR-automated** via Tesseract.js (client-side, free)
> - UPI ID verification at signup uses in-browser OCR + admin fallback
> - Tesseract.js added as Phase 1 dependency (free, in-browser, ~3MB Wasm)
> - Still **₹0/month** operational cost — OCR runs on the user's device
>
> **Changes from v0.2.0 → v0.3.0** (carried forward)
> - Phase 1 is now **zero-cost** (free tiers only, no paid verification APIs)
> - Cashfree integration moved entirely to Phase 2
>
> **Changes from v0.1.0 → v0.2.0** (carried forward)
> - Phase 1 reframed as 30–50 user closed friends-and-family pilot
> - TrustScore rescaled to CIBIL-style 300–900 range with named bands
> - KYC simplified to manual upload + admin review for Phase 1; DigiLocker moved to Phase 2
> - Account Aggregator firmly moved to Phase 2 (FIU registration requires being a regulated entity)
> - WhatsApp Business API moved to Phase 2
> - Added §22 "Lessons from existing Indian P2P platforms"

---

## 0. How to read this document

This is the **master architecture document** for TrustPe. It sets the boundaries, names the components, and codifies every decision we have made so far. It deliberately stops short of full schema and API detail — those live in the satellite documents listed above.

If a decision in a satellite document ever appears to conflict with this file, this file wins until it is updated.

The four core engineering principles for this codebase, all derived from your stated requirements:

1. **Regulation-agnostic by construction.** Money movement, KYC, eSign, credit-bureau, and reporting all live behind adapter interfaces. Swapping a stub for a real provider must never touch domain code.
2. **Phased deliverability.** Phase 1 must be shippable in 6–10 weeks by a solo LLM-assisted developer. Phase 2 and Phase 3 do not require code rewrites — only swapping adapter implementations and turning on feature flags.
3. **Trust is a first-class object.** Profile health, vouches, reputation, and behavioral signals are not bolted on. They are part of the core domain model from the first migration.
4. **Audit everything that touches money or identity.** Every write to a money-touching or KYC-touching collection produces an immutable audit-log entry with actor, timestamp, IP, device fingerprint, and before/after diff.

---

## 1. Executive summary

TrustPe is a trust-based peer-to-peer lending marketplace for India. Borrowers seek micro-loans (₹5,000–₹50,000, 1–6 months). Lenders fund those loans. The platform matches them, generates the agreement, tracks repayment, and publicly records reputation.

The differentiator versus existing Indian P2P platforms is the **progressive trust ladder**: every user starts at a small borrowing cap, and successful repayment expands their cap and their public reputation. This makes the platform usable by lower-income users with no formal income proof, because trust is grown on-platform rather than imported from CIBIL.

### 1.1 Locked decisions

| Area | Decision |
|---|---|
| Brand name | **TrustPe** |
| Positioning | India's trust-based P2P lending marketplace |
| Loan economics | ₹5,000–₹50,000 principal, 1–6 month tenure |
| Mobile strategy | **React Native (Expo) Android in Phase 1; iOS in Phase 2; web (Next.js) for admin only in Phase 1** |
| Repository structure | Monorepo (pnpm + Turborepo) — `apps/mobile`, `apps/admin`, `apps/api`, `packages/core` |
| Admin / web hosting | Vercel (free tier) — admin panel only in Phase 1 |
| Mobile distribution (Phase 1) | Expo internal distribution (direct APK install link shared via WhatsApp / email to invitees); Play Store deferred to Phase 2 |
| Backend hosting | Render (free tier) |
| Database | MongoDB Atlas (free tier M0) |
| File storage | Cloudinary (free tier) |
| Realtime | Socket.io |
| Auth | JWT access + refresh, httpOnly cookies |
| Styling | Tailwind CSS |
| Language | TypeScript everywhere |
| **Phase 1 pilot size** | **30–50 users, invite-only, friends-and-family network** |
| **Phase 1 budget** | **₹0/month operational cost (free tiers only). Domain ~₹800/year is the only fixed cost.** |
| **Phase 1 KYC** | **Manual upload (Aadhaar front+back + PAN front + selfie video + UPI app screenshot) + admin review for Aadhaar/PAN; OCR auto-verify for UPI** |
| **Phase 1 UPI ID verification** | **Tesseract.js OCR on uploaded UPI app screenshot auto-extracts UPI ID + name; server matches against typed VPA and KYC name. Admin handles only low-confidence cases.** |
| **Phase 1 payment verification** | **Native UPI Intent Result (primary): RN app fires `startActivityForResult` with `upi://` deep link; UPI app returns `Status`, `txnRef` (UTR), `Amount`, `txnId`, etc. directly. Asymmetric: payer's Intent return is the evidence; receiver attests with single tap (24h retraction). Screenshot+OCR is fallback when Intent return is incomplete or for iOS users in Phase 2.** |
| **Phase 1 notifications** | **Email + in-app only. WhatsApp deferred to Phase 2.** |
| **TrustScore range** | **300–900 CIBIL-style with five named bands** |
| **Lender capacity check** | **Self-declared monthly capacity + cap on simultaneous open offers** |
| **Phase 1 default handling** | **Score impact + public review + admin facilitation (personal outreach)** |
| Pilot scope | Pan-India-capable code, city-gated at launch (single city for Phase 1) |
| Regulatory path | Undecided → adapter pattern keeps both options open |
| Team | Solo + LLM-assisted (Claude / Cursor) |

### 1.2 Deferred decisions

| Area | Why deferred | Forcing function |
|---|---|---|
| NBFC-P2P license vs partner | Needs legal counsel + capital decision | Required before Phase 3 launch |
| Final pilot city | Awaits founder preference (Bengaluru / Pune / Hyderabad / hometown / etc.) | Required before Phase 1 invite rollout |
| Cashfree onboarding (Penny Drop + UTR Recon) | Phase 2 work item — only when verification budget approved | Required for Phase 2 automation |
| WhatsApp Business display name | Phase 2 work item — start onboarding when Phase 2 build begins | Required to start Meta onboarding (2–3 wk lead time) |
| Credit bureau (CIBIL/Experian) | Free tier doesn't include it; not strictly needed for tiny pilot | Decide by Phase 2 |
| DigiLocker direct integration vs partner | Phase 2 work item | Pick once Phase 1 demonstrates demand |
| AA partnership (Setu/Finvu sponsored-FIU) | Phase 2 work item | Pick once Phase 1 demonstrates need for alt-data |

---

## 2. Legal and compliance position

This section codifies the legal stance the architecture is designed around. Engineering decisions in later sections refer back to it.

### 2.1 The RBI NBFC-P2P requirement

Under the **Master Directions — Non-Banking Financial Company – Peer to Peer Lending Platform (Reserve Bank) Directions, 2017** (updated August 2024), any entity in India that matches lenders to borrowers for consideration is a P2P lending platform and must be registered as an NBFC-P2P with RBI. Key constraints from the 2024 update that **must** shape the architecture:

- All fund movement must flow through a SEBI-registered trustee-operated escrow. No direct lender-to-borrower bank transfers as a registered NBFC-P2P.
- T+1 settlement maximum. Platform cannot hold float beyond a single day.
- Aggregate lender exposure to a single borrower capped at ₹50,000.
- Aggregate borrower exposure across all platforms capped at ₹10,00,000.
- Loan tenure cannot exceed 36 months.
- Cross-selling of insurance products is prohibited.
- Promised/guaranteed returns to lenders are prohibited (this is what tripped up LenDenClub's Hyperfix).
- No pooling/fractional investment models that obscure the 1-to-1 lender-borrower relationship.
- Mandatory CKYC + Aadhaar-based identification.
- Mandatory grievance redressal officer with published contact details.
- Quarterly reporting to RBI.
- Net Owned Funds (NOF) requirement: ₹2 crore.

### 2.2 How Phase 1 stays out of regulatory hot water

Because the NBFC-P2P decision is deferred, Phase 1 operates as a **trust and matching platform that does not move money**, at a scale (30–50 friends-and-family users) that is structurally below regulatory radar. Concretely:

- The platform never touches user funds. Lender transfers UPI directly to borrower. Both parties' UPI IDs are penny-drop verified at signup. After each transfer, the payer enters the UTR and the platform auto-verifies via Cashfree/Decentro UTR lookup. No money flows through us at any point.
- Agreements in Phase 1 are click-wrap (IT Act §10A enforceable, IP + device + timestamp logged) rather than Aadhaar eSign.
- No public claims of "P2P lending platform" until license question is resolved. Marketing language uses "peer lending circle" / "trust-based lending community" instead.
- Onboarding terms explicitly disclose that the platform is a facilitator, not a party to the loan.
- Invite-only friends-and-family scope means TrustPe is not publicly accepting general users — closer to a private beta than a regulated public service.

This posture is what every current Indian P2P platform looked like at MVP. It is not a permanent posture — at Phase 3 the platform either becomes a licensed NBFC-P2P or partners with one, at which point the payment-provider adapter swaps in real escrow.

### 2.3 India-specific compliance items the architecture must support

| Requirement | Source | How architecture handles it |
|---|---|---|
| Aadhaar number must not be stored | Aadhaar Act §29 + UIDAI circulars | Phase 1 stores Aadhaar **image** for admin verification, encrypted at rest in Cloudinary, with retention policy. Phase 2 switches to DigiLocker-fetched XML which only exposes last-4. |
| KYC records retained 5 years post-relationship | PMLA Rules | `kyc_records` collection rows soft-deleted, hard-deleted only after 5-year window |
| Data localization | RBI Data Storage Norms (2018) | MongoDB Atlas cluster in `ap-south-1` (Mumbai). Cloudinary `region: ap-south-1`. |
| Loan agreement e-stamping | State Stamp Acts | Phase 2 integrates SignDesk/Digio for e-stamping per borrower's state. Schema reserves `stampPaperId` field from day 1. |
| Grievance redressal | RBI ombudsman scheme | Dispute system + published GRO contact in app footer. |
| DPDP Act (2023) | Digital Personal Data Protection Act | Consent flags per data category, right-to-erasure endpoint, data-portability export endpoint, breach-notification log table. |
| Transaction reporting | FIU-IND PMLA | Audit-log collection retains 5 years; STR/CTR export job stub from day 1. |
| Interest rate caps | RBI Fair Practice Code | Cap configurable per loan-tier in `feature_flags`. Phase 1 default cap: 36% APR. |

---

## 3. MVP scope — what ships when

The "what features ship in which phase" decision is the single biggest determinant of timeline. Below is the locked scope.

### 3.1 Phase 1 — Closed Friends-and-Family Pilot

**Goal:** validate the trust-and-matching mechanic with 30–50 invited users in one city, completing 20–40 real micro-loans.

**Phase 1 stack:**
- **User app**: React Native (Expo Managed workflow), Android only. Distributed via direct APK install (Expo internal distribution link shared with invitees).
- **Admin panel**: Next.js (Vercel-hosted, password-gated). Only the founder uses it.
- **Backend**: Node + Express + TypeScript (Render-hosted).
- **Shared code**: `packages/core` — domain types, zod schemas, business logic — consumed by RN, admin, and backend.

**No public website in Phase 1.** Invite-only via direct app-install links. We add a Next.js marketing site + public profile SSR in Phase 2 when we open signup.

**Timeline:** 8–12 weeks of build + 8–12 weeks of operation before deciding whether to expand to Phase 2. (Slightly longer than the previous PWA-based estimate because of native build setup, but offset by Expo's Managed workflow keeping native config minimal.)

**In scope:**

*Signup and identity:*
- Invite-code-gated signup (each existing user can issue 1–2 invite codes; admin issues seed invites). Invite link opens the APK install (Expo internal distribution) on first tap.
- Phone OTP via email (sent to user's email; SMS/WhatsApp deferred). Reasoning: at 30–50 friends-and-family users, every user can register an email and we save the SMS gateway cost / WhatsApp Meta-onboarding lead time.
- Biometric unlock (fingerprint / face) for app entry via Expo LocalAuthentication, optional but encouraged for KYC-completed users.
- Manual KYC: user captures Aadhaar front photo + Aadhaar back photo + PAN front photo + 5-second selfie video using RN's native camera (Expo ImagePicker / Camera). Images uploaded to Cloudinary via signed-upload preset.
- **UPI ID self-attestation with in-app OCR**: user types their primary UPI ID + captures a screenshot from their UPI app (GPay / PhonePe / Paytm / BHIM) clearly showing their full name and the same UPI ID. App provides annotated guide screens showing exactly where to find this in each major UPI app. **Tesseract OCR runs in the RN app (via JS bridge), extracts UPI ID + name from the screenshot, server compares against typed VPA and KYC name. High-confidence matches are auto-approved without admin involvement.**
- Admin reviews Aadhaar + PAN + selfie video in one pass, plus only the UPI screenshots where OCR confidence was low or names didn't match (expected: ~10–15% of users)
- Bank account (account number + IFSC) captured for record only — used for legal documentation in the loan agreement (no penny drop, no automated verification in Phase 1)

*Profile:*
- Profile with photo, declared occupation, declared monthly income, city, bio
- Public profile page (`/u/:handle`) showing TrustScore, band, completed loans, reviews — SEO-friendly SSR
- TrustScore 300–900 CIBIL-style with five named bands and transparent factor breakdown

*Borrowing:*
- Loan request creation (amount ₹5,000–₹50,000, tenure 1–6 months, purpose, max acceptable ROI)
- Loan request expires after configurable duration (default 7 days)
- Loan request listing visible to other users (lenders browse)

*Lending:*
- Lender browse: filter by amount, tenure, borrower TrustScore band, city
- Lender self-declares monthly lending capacity at signup; system caps total value of open offers to that amount
- Lender makes offer (counter-amount, counter-ROI, message)
- Negotiation thread (Socket.io) between borrower and lender
- Acceptance moves request → loan

*Agreement:*
- Click-wrap loan agreement PDF generation (PDFKit, template versioned)
- Both parties view PDF, scroll-locked accept button, IP + device + timestamp + SHA-256 hash recorded
- PDF stored in Cloudinary with signed-URL access

*Money flow (native Intent primary; OCR fallback; receiver attestation):*

**Disbursement (lender → borrower) — happy path with native Intent:**
- Lender taps "Pay Borrower" in the RN app.
- RN fires Android Intent via `startActivityForResult` with the UPI deep link `upi://pay?pa=<borrower-vpa>&pn=<borrower-name>&am=<amount>&tn=<TRUSTPE-loanId>&cu=INR`.
- Android shows the UPI-app chooser (GPay / PhonePe / Paytm / BHIM / etc.). Lender picks one and completes payment.
- UPI app returns an Intent Result to TrustPe with structured fields per NPCI spec:
  - `Status` = `SUCCESS` | `FAILURE` | `SUBMITTED`
  - `txnRef` = the 12-digit UTR/RRN
  - `txnId` = the UPI app's internal transaction ID
  - `Amount` = decimal amount
  - `ApprovalRefNo` = bank approval reference
  - `responseCode` = `00` for success
- RN parses the result, validates `Status=SUCCESS`, calls backend `submitPayerEvidence({ paymentIntentId, intentReturn })`. Server cross-validates: `Amount` matches expected? `responseCode=00`? `txnRef` looks valid (12-digit pattern)?
- On success → `payment_intent` → `payer_confirmed`. Intent return payload stored in audit log. **No screenshot, no OCR, no manual UTR typing.**

**Disbursement — fallback path when Intent return is incomplete:**
Some UPI apps return partial data or no Intent result (especially older versions, or some custom OEM UPI apps). When `txnRef` is missing or `Status` is `SUBMITTED` (not yet confirmed), RN falls back to screenshot capture:
- App prompts: "Take a screenshot of the payment-success page in your UPI app and tap upload."
- RN uses Android share-target or image-picker (gallery) to receive the screenshot.
- **Tesseract OCR runs in the RN app** (via `react-native-tesseract-ocr` or a Wasm/JS bridge), extracts UTR + amount + payee VPA + status.
- Same confirmation card UX as previously specified. Same per-app guidance for which field is the UTR (GPay's "Bank Reference ID," PhonePe's "UPI Reference No," etc.).
- Server cross-validates extracted values; success → `payer_confirmed`.

**Borrower attestation (single tap, identical to v0.5):**
- Borrower receives push notification via Expo Push Service ("Lender has paid ₹X. Please confirm you received it.") + email backup.
- Borrower opens the loan screen in the RN app. Sees lender's Intent return data (or screenshot if fallback was used). Three actions:
  - **"Yes, I received it"** (primary green button, single tap) → `payment_intent` → `auto_verified`. Loan → ACTIVE. EMI schedule generated. Push notifications fire to both.
  - **"Let me check first"** → helper screen with deep-link buttons to open UPI app and SMS inbox.
  - **"I did not receive it"** (smaller text link) → opens dispute flow with reason field.
- Optional: "Attach my bank SMS or UPI screenshot too" — RN's gallery picker; stored as evidence alongside, no OCR matching required.
- **24-hour retraction window**: if borrower taps "I confirmed by mistake" within 24h, loan moves to `confirmation_retracted_review` and admin investigates.
- Reminder cadence if no response: 24h, 36h, 48h push + email. At 72h → admin queue.

**EMI payment (borrower → lender):**
- Symmetric flow. Borrower fires UPI Intent from RN, gets structured return, server validates. Lender attests with single-tap "Yes, received." Same retraction window and dispute paths.

**Pre-closure:** same flow with pre-closure quote.

**Part payments** supported with allocation order (penalty → overdue interest → current interest → principal).

**Manual UTR typing** remains as the universal last-resort fallback, for cases where both Intent return AND screenshot OCR fail. Server cross-validation against expected amount/VPA still runs.

**All Intent returns, screenshots, OCR outputs, attestations, and retractions** are append-only in `audit_logs`. No payment intent is ever silently auto-completed.

*Lifecycle:*
- Full state machine (DRAFT → OPEN → NEGOTIATION → AGREEMENT_PENDING → AWAITING_DISBURSAL → ACTIVE → ACTIVE_DELINQUENT → DISPUTED_OVERDUE → CLOSED / PRECLOSED / DEFAULTED)
- EMI schedule auto-generated on disbursal
- Late fee + penal interest accrual via daily cron
- Loan auto-expiry for unaccepted requests

*Trust and reputation:*
- TrustScore recomputed on every relevant event (snapshots stored)
- Public default registry entry on DEFAULTED state
- Reviews (post-closure window of 7 days, both directions)
- Review impact on TrustScore weighted by loan amount

*Communication:*
- Real-time chat (Socket.io) inside every loan/negotiation thread
- Document sharing inside chat (Cloudinary signed uploads)
- Typing indicators, read receipts, unread counts
- Off-platform money negotiation detection (regex for UPI ID / phone patterns) → soft warning, admin log

*Disputes:*
- User-initiated dispute on any active loan
- Counterparty response window (48h)
- Both parties upload evidence
- Admin (you) adjudicates in admin panel
- Decision: borrower_favor / lender_favor / split / inconclusive
- Score and loan-state effects per decision

*Notifications:*
- In-app feed (notification center, unread badge)
- Transactional email via Resend free tier (KYC status, new offer, EMI reminder 3d/1d/due/overdue, dispute updates, loan disbursed/closed)

*Admin (you-only):*
- User list/search/view/suspend
- KYC review queue with approve/reject/clarify
- Loan monitoring dashboard
- Pending UTR verifications (where auto-verify failed)
- Dispute queue
- TrustScore breakdown viewer with manual recompute
- Audit log viewer
- Feature flags toggle
- Manual default outreach helper (defaulted-loan list with contact details + suggested message templates)

*Engineering hygiene:*
- Full TypeScript + Zod across stack
- Audit log on every money/KYC/state change
- Device + IP logging on every session
- Refresh token rotation with theft detection
- Rate limiting (Redis, three tiers)
- Sentry + Better Stack logs

**Out of scope (Phase 2 or later):**

- DigiLocker eKYC (Phase 2)
- Aadhaar eSign agreements (Phase 2)
- Cashfree payment links / true escrow (Phase 3)
- UPI AutoPay / NPCI eMandate (Phase 3)
- CIBIL/Experian/CRIF credit pull (Phase 2 optional, Phase 3 default)
- Account Aggregator integration (Phase 2 via partnership)
- WhatsApp Business API (Phase 2)
- SMS via MSG91 (Phase 2)
- React Native app (Phase 2)
- Community vouching UI (schema reserved in Phase 1, UI in Phase 2)
- Auto-invest for lenders (Phase 3 — see §22 lessons learned)
- Selfie liveness automation via Hyperverge (Phase 2)
- Penny drop on bank account (Phase 2; UPI penny drop sufficient for Phase 1)
- Open signup (Phase 2)
- Multi-city expansion (Phase 2)
- Public-facing landing pages with marketing copy (Phase 1 keeps it minimal)
- Refer-and-earn mechanics (Phase 2)
- Hindi/Bengali UI (Phase 3+)
- Advanced fraud rules (Phase 2)
- Legal-notice automation (Phase 3)
- Detailed analytics dashboards (Phase 2)
- Multi-admin RBAC roles (Phase 1 = one admin = you; Phase 2 expands)

### 3.2 Phase 2 — Open Beta

**Goal:** Open the platform to 500–5,000 users across multiple cities, automate manual operations, build the integrations that scale beyond an admin doing everything by hand.

**Entry criteria from Phase 1:**

- 30–40+ completed loans in Phase 1
- Default rate < 12% (industry benchmark for unsecured P2P)
- Repayment-on-time rate > 75%
- Founder confident in product-market signal
- Phase 2 build budget approved (~₹50K–₹2L for integrations)

**Timeline:** 8–14 weeks of build after Phase 1 entry decision.

**New in Phase 2:**

*KYC automation:*
- DigiLocker integration (direct as Registered Requestor Agency, or via Setu/Perfios partner) for Aadhaar Offline XML eKYC → swap KYC adapter, ~₹0–2 per check
- Hyperverge selfie liveness → swap KYC adapter, ~₹3–10 per check
- Cashfree Penny Drop on bank account → swap KYC adapter, ~₹2 per check
- PAN OCR + NSDL verification → automated PAN check, ~₹0.50 per check

*Agreement:*
- Aadhaar eSign via Digio → swap agreement adapter, ~₹15–25 per agreement
- State-specific e-stamping where applicable

*Payments:*
- **Cashfree Penny Drop** at signup → swap UPI verification from "screenshot + admin review" to automated VPA-to-name verification (~₹2/user one-time)
- **Cashfree UTR Recon** per payment → swap bilateral UTR confirmation to authoritative third-party UTR lookup (~₹1/payment). Bilateral confirmation remains as fallback when API can't find UTR within 30 min.
- (Optional pre-escrow): Cashfree Payment Links for collection (money briefly through platform, payment-link model — gray zone but standard pre-NBFC) → swap payment adapter
- Continue UPI-Intent flow as primary user experience; only verification mechanism upgrades

*Alt-data:*
- Account Aggregator via partner (Setu/Finvu sponsored-FIU model) → new adapter, used for income/expense pattern signals to enrich TrustScore
- Optional CIBIL pull via Experian/CRIF (~₹20–50/pull, used only at lender's request for offers above ₹25K)

*Communication:*
- WhatsApp Business API onboarding completed; WhatsApp notifications for OTP, EMI reminders, agreement-ready, dispute updates
- SMS fallback via MSG91 with DLT registration

*Trust:*
- Community vouching UI turned on
- Refer-and-earn mechanic
- TrustScore weights tuned based on Phase 1 data
- Behavioral signals (login frequency, response time, device consistency) added

*Mobile and web:*
- **iOS React Native build** added (shared codebase with Android; only platform-specific UPI Intent handling differs)
- **Google Play Store release** (closed testing → production) — replaces direct APK distribution
- **Apple App Store release** (TestFlight → production) — for iOS users
- **Public Next.js website** added (`apps/web`): marketing landing, SSR public profile pages for SEO, invite-request form. Hosted on Vercel.
- **Play Integrity API** integration for app attestation (fraud control)

*Scale:*
- Open signup (no invite required)
- Multi-city
- Auto-fraud rules turned on (duplicate identity, device clustering, IP clustering, velocity, geo-anomaly, etc.)
- Admin RBAC expanded (support / compliance / finance roles distinct from super_admin)
- Analytics dashboards

*Compliance:*
- NBFC-P2P partnership conversation begins in parallel (target: have a signed term sheet by end of Phase 2)
- Penetration test by CERT-In empaneled vendor
- IS audit preparation

### 3.3 Phase 3 — Compliant Launch

**Goal:** Resolve the regulatory question and run as a fully compliant P2P platform.

**Two possible paths, both supported by the architecture:**

- **Path A (partner):** Wire white-label arrangement with a licensed NBFC-P2P. Their escrow API replaces the Cashfree payment-link adapter. RBI reporting becomes their responsibility (or co-responsibility via reporting adapter).
- **Path B (own license):** Apply for NBFC-P2P license. Once granted, integrate true escrow with SEBI-registered trustee. Quarterly RBI reporting via reporting adapter.

**Additional Phase 3 features regardless of path:**

- True escrow (money flows through platform-controlled escrow with T+1 settlement)
- UPI AutoPay / NPCI eMandate for automated EMI collection
- Public default registry (full schema already in place from Phase 1; goes live in Phase 3)
- Legal-notice automation for repeat defaulters (template-based, manually triggered initially)
- Pan-India open
- iOS React Native build
- Hindi + Bengali UI (top two non-English Indian languages by P2P user volume)

---

## 4. Technology stack and rationale

| Layer | Choice | Why |
|---|---|---|
| **User app (Phase 1)** | **React Native 0.81 + React 19.1 + Expo SDK 54 (Managed workflow), Android only, TypeScript** | **Native UPI Intent Result support, native biometric unlock, push notifications via Expo, fast iteration via Expo Updates OTA. Managed workflow means we never touch native Android Studio code unless absolutely needed.** |
| **User app (Phase 2)** | **Same codebase + iOS build via EAS Build** | **iOS RN shares 95%+ of the code with Android. Platform-specific code only for UPI Intent handling (iOS uses URL Scheme handoff which is less reliable; OCR fallback is more important on iOS).** |
| Admin panel | Next.js 14 (App Router) + TypeScript + Tailwind | Web-first admin (you on laptop). Vercel-hosted, password-gated. |
| Public website (Phase 2) | Same Next.js app or separate `apps/web` | Marketing + SSR public profile pages for SEO. Added when we open signup. |
| Backend | Node.js 20 + Express 4 + TypeScript | Familiar, fast enough for Phase 1–3, huge ecosystem for Indian fintech (Cashfree/Digio/Setu all have official Node SDKs). |
| Realtime | Socket.io | Battle-tested, fallback to long-polling, room semantics natural for loan-thread chat. |
| Database | MongoDB Atlas (M0 free) | Document model fits the loan/profile/event shapes well. Free tier is enough for Phase 1's 30–50 users. Atlas in `ap-south-1` for data localization. |
| Cache + rate limit + queues | Upstash Redis (free tier) | Free 10K commands/day is enough for Phase 1. Used for rate limiting, OTP store, Socket.io adapter, and BullMQ job queue. |
| Object storage | Cloudinary (free tier) | KYC docs, screenshots, agreement PDFs. Transformations free. Signed-URL access. |
| Auth | Custom JWT (access 15 min + refresh 30 days, rotating). RN stores tokens in Expo SecureStore (Keystore-backed). Admin web stores access in memory + refresh in httpOnly+Secure+SameSite=Lax cookie. | No vendor lock-in, fintech-grade audit ability. |
| Validation | Zod | Schemas shared between client and server via `packages/core`. |
| ORM | Mongoose | Schema + middleware hooks help enforce audit-log writes. |
| Job queue | BullMQ (Redis-backed) | EMI reminder cron, profile-health recompute, notification dispatch. |
| Logging | Pino (structured JSON) + Better Stack free tier | Structured logs, free hosted aggregator. |
| Error tracking | Sentry (free tier) | Both frontend and backend. |
| CI | GitHub Actions free tier | Lint, typecheck, unit test, e2e on PR. |
| Testing | Vitest (unit + integration), Playwright (e2e) | Vitest is faster than Jest and shares config across the monorepo. |
| Email | Resend (free 3K/mo) | Best Node SDK ergonomics among free email providers. Phase 1 OTP delivery. |
| **Push notifications (Phase 1)** | **Expo Push Service (free, FCM under the hood)** | **Free, simple API, abstracts FCM. Used for OTP-backup, EMI reminders, attestation requests, dispute updates.** |
| **Mobile build (Phase 1)** | **EAS Build (Expo, free tier)** | **Cloud builds APK; free tier allows ~30 builds/month which is plenty for a 6–12 week build cycle.** |
| **Mobile distribution (Phase 1)** | **Expo internal distribution / direct APK link** | **No Play Store fees, no review delays. Friends install APK from a shared URL. Phase 2 moves to Play Store.** |
| **Secure storage (Phase 1)** | **Expo SecureStore (Android Keystore-backed)** | **Encrypted local storage for access + refresh tokens. Replaces httpOnly cookies (which RN doesn't have).** |
| **Biometric auth (Phase 1)** | **Expo LocalAuthentication** | **Fingerprint / face unlock for app entry. Optional but encouraged after KYC.** |
| **UPI Intent handling (Phase 1)** | **`react-native-upi-payment` or custom native module via Expo Dev Client** | **Fires `startActivityForResult` with `upi://` deep link; parses NPCI-standard return values. Primary payment-confirmation path.** |
| **OCR engine (fallback, Phase 1)** | **Tesseract OCR in RN (via JS bridge or `react-native-tesseract-ocr`)** | **Zero cost. Used only when native Intent return is incomplete or for diagnostic / dispute evidence. Extracts UTR + amount + payee VPA from screenshots.** |
| **UPI verification (Phase 1)** | **OCR-extracted UPI ID + name from screenshot captured in-app, server compares against typed VPA and KYC name** | **Zero cost. ~85–90% auto-verify rate. Admin handles low-confidence cases only.** |
| **Payment verification (Phase 1)** | **Native UPI Intent Result (primary) + OCR screenshot fallback; receiver one-tap attestation closes the loop** | **Zero cost. ~95% Intent-Result success rate on Android; OCR fallback covers remaining ~5%.** |
| Monitoring uptime | UptimeRobot (free) | 5-min interval, enough for Phase 1. |
| Secrets | `.env` + Vercel/Render envs (Phase 1) → Doppler (Phase 2) | Doppler when team grows. |

**Phase 1 monthly cost estimate (30–50 users, ~40 loans, ~120 payments):**

| Item | Cost |
|---|---|
| All hosting + DB + storage + email + monitoring (free tiers) | ₹0 |
| UPI verification (OCR + admin review for low-confidence) | ₹0 |
| Payment verification (native UPI Intent Result + OCR fallback) | ₹0 |
| EAS Build, Expo Push, Expo SecureStore | ₹0 (Expo free tier) |
| Domain (`trustpe.in`) | ~₹800/year (~₹70/month amortized) |
| **Total Phase 1 ongoing** | **₹0/month operational, ~₹800/year for domain** |

This is a genuinely zero-budget fintech MVP. The only real cost is the founder's time.

---

## 5. High-level system architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER DEVICES                                │
│   ┌─────────────────────────────────┐  ┌──────────────────────┐     │
│   │ Android RN app (Phase 1)         │  │ Admin panel (web)    │     │
│   │ Expo Managed                     │  │ Next.js / Vercel     │     │
│   │ • Native UPI Intent              │  │ (founder only)       │     │
│   │ • Biometric unlock               │  │                      │     │
│   │ • Push (FCM via Expo)            │  └──────────┬───────────┘     │
│   │ • SecureStore tokens             │             │                  │
│   └──────────────────┬───────────────┘             │                  │
│                      │ HTTPS + WSS                 │ HTTPS + WSS      │
│   [Phase 2: iOS RN]  │                             │                  │
│   [Phase 2: public  Next.js website]               │                  │
└──────────────────────┼─────────────────────────────┼──────────────────┘
                       │                             │
                       └──────────────┬──────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│              RENDER — TrustPe API (Express + Socket.io)              │
│   ┌───────────────────────────────────────────────────────────────┐  │
│   │  HTTP layer (Express routes, validation, rate limit)          │  │
│   ├───────────────────────────────────────────────────────────────┤  │
│   │  Application layer (services, use-cases, orchestration)       │  │
│   ├───────────────────────────────────────────────────────────────┤  │
│   │  Domain layer (entities, value objects, state machines)       │  │
│   ├───────────────────────────────────────────────────────────────┤  │
│   │  Adapter layer (IPaymentProvider, IKycProvider, etc.)         │  │
│   └───────────────────────────────────────────────────────────────┘  │
│   ┌───────────────────────────┐  ┌───────────────────────────────┐  │
│   │  Socket.io server         │  │  BullMQ workers               │  │
│   │  (chat, live loan state)  │  │  (UTR recon, EMI cron, notify)│  │
│   └───────────────────────────┘  └───────────────────────────────┘  │
└────────┬────────────────────┬──────────────────────┬─────────────────┘
         │                    │                      │
         ▼                    ▼                      ▼
┌──────────────────┐ ┌──────────────────┐ ┌─────────────────────────┐
│ MongoDB Atlas    │ │ Upstash Redis    │ │ External integrations   │
│ (primary store)  │ │ (cache/queue/RL) │ │ Phase 1 (free tiers):   │
│   ap-south-1     │ │                  │ │ • Cloudinary            │
│                  │ │                  │ │ • Resend (email)        │
│                  │ │                  │ │ • Tesseract.js (OCR,    │
│                  │ │                  │ │   client-side)          │
│                  │ │                  │ │                         │
│                  │ │                  │ │ Phase 2 (paid):         │
│                  │ │                  │ │ • Cashfree (UPI + UTR)  │
│                  │ │                  │ │ • Meta WhatsApp API     │
│                  │ │                  │ │ • DigiLocker (via Setu) │
│                  │ │                  │ │ • Digio (eSign)         │
│                  │ │                  │ │ • Setu AA (alt-data)    │
│                  │ │                  │ │ • Hyperverge (liveness) │
│                  │ │                  │ │ • MSG91 (SMS, DLT)      │
└──────────────────┘ └──────────────────┘ └─────────────────────────┘
```

Notes on the diagram:

- The Next.js apps do *no* business logic. They are presentation only, plus a thin auth middleware. All domain logic lives in the backend.
- Server Actions are used only for non-money-touching mutations (e.g., updating profile bio). All money-touching operations go through versioned REST endpoints with idempotency keys.
- Socket.io runs on the same Express process in Phase 1. When we scale, it gets pulled into its own service with the Redis adapter for horizontal scaling — no code change beyond config.
- BullMQ workers run as separate Render web services (one process per worker type) sharing the same Redis.
- The UTR Recon worker runs on a 30-minute cron and retries any pending payment for up to 24h before escalating to admin queue.

---

## 6. Backend architecture — layered with adapters

The backend follows a **clean-architecture layered model** with the adapter pattern at the edges. This is the most important architectural decision in the document because it is what makes the Phase 1 → Phase 3 transition non-destructive.

### 6.1 The four layers

```
   ┌────────────────────────────────────────────────┐
1. │  Interface layer (Express routes, Socket.io)   │   ← HTTP/WS concerns only
   ├────────────────────────────────────────────────┤
2. │  Application layer (use-cases / services)      │   ← Orchestration only
   ├────────────────────────────────────────────────┤
3. │  Domain layer (entities, VOs, state machines)  │   ← Pure business logic
   ├────────────────────────────────────────────────┤
4. │  Adapter layer (Mongo repos, providers)        │   ← External world
   └────────────────────────────────────────────────┘
```

Rules:

- **Dependency arrow points inward.** Domain knows nothing about Mongo, Express, Cashfree, or Socket.io. Adapters depend on domain interfaces, not the other way around.
- **No business logic in route handlers.** Routes parse, validate, call a use-case, format the response. That's it.
- **No I/O in domain.** Domain entities are pure TypeScript. They do not import Mongoose, fetch, axios, etc.
- **One use-case per "thing the user does."** `RequestLoanUseCase`, `MakeLoanOfferUseCase`, `AcceptOfferUseCase`, `RecordEmiPaymentUseCase`, etc. Each is testable in isolation.

### 6.2 The provider interfaces (the adapter pattern in practice)

These are the seams that let Phase 1 ship without paid integrations and Phase 3 swap in real ones without touching domain code. All live in `packages/core/src/ports/`.

```typescript
// IPaymentVerificationProvider — verifies a payment happened
interface IPaymentVerificationProvider {
  // VPA-to-name check (used at signup)
  verifyUpiId(input: {
    vpa: string;
    expectedKycName: string;
    screenshotPublicId?: string;       // Phase 1: required (Cloudinary ID)
    ocrExtraction?: OcrExtraction;     // Phase 1: client-side OCR output
  }): Promise<UpiVerificationResult>;
  // returns { status: 'verified'|'low_confidence'|'name_mismatch'|'manual_review_required',
  //          confidence, extractedVpa, extractedName, fuzzyNameMatchScore }

  // Single-side UTR verification (Phase 2+ via paid API)
  verifyTransaction(input: {
    utr: string;
    expectedAmountPaise: number;
    expectedPayerVpa: string;
    expectedPayeeVpa: string;
    notBeforeAt: Date;
  }): Promise<TxnVerificationResult>;

  // Payer side: structured Intent return (Phase 1 primary, Android native)
  submitPayerEvidence(input: {
    paymentIntentId: string;
    evidenceType: 'native_intent' | 'screenshot_ocr' | 'manual_entry';
    intentReturn?: UpiIntentReturn;     // when evidenceType='native_intent'
    screenshotPublicId?: string;        // when evidenceType='screenshot_ocr' or manual
    ocrExtraction?: OcrExtraction;      // when evidenceType='screenshot_ocr'
    manualUtr?: string;                 // when evidenceType='manual_entry'
  }): Promise<PayerEvidenceResult>;
  // returns { status: 'payer_confirmed'|'low_confidence_review'|'amount_mismatch'|'vpa_mismatch'|'intent_failure' }

  // Type for structured Intent return data (Android NPCI spec)
  type UpiIntentReturn = {
    Status: 'SUCCESS' | 'FAILURE' | 'SUBMITTED';
    txnRef: string;                     // 12-digit UTR/RRN — authoritative
    txnId?: string;                     // UPI app's internal ID
    Amount?: string;                    // decimal amount
    ApprovalRefNo?: string;
    responseCode?: string;              // '00' for success
    raw: string;                        // full raw return string for audit
  };

  // Receiver side: single-tap attestation (Phase 1 primary)
  submitReceiverAttestation(input: {
    paymentIntentId: string;
    attestation: 'received' | 'not_received' | 'retracted';
    optionalScreenshotPublicId?: string;   // receiver may attach evidence; no OCR matching required
    reason?: string;                       // for 'not_received' or 'retracted'
  }): Promise<ReceiverAttestationResult>;
  // returns { status: 'auto_verified'|'disputed'|'admin_queue' }
}

type OcrExtraction = {
  rawText: string;                     // full OCR text dump for audit
  extractedUtr?: string;
  extractedAmountPaise?: number;
  extractedPayeeVpa?: string;
  extractedPayerVpa?: string;
  extractedStatus?: string;
  confidence: number;                  // 0–1
  ocrEngine: 'tesseract.js' | 'server-tesseract';
  ocrEngineVersion: string;
};

// Phase 1 implementation: NativeIntentWithOcrFallbackProvider
//   - verifyUpiId: validates OCR extraction matches typed VPA; fuzzy-matches OCR name to KYC name;
//                  returns 'verified' if confidence>0.65 and both match, else admin queue
//   - verifyTransaction: throws NotSupportedInPhase1Error
//   - submitPayerEvidence:
//       * evidenceType='native_intent': validates Intent return Status=SUCCESS, responseCode=00,
//         Amount matches expected; stores raw Intent return in audit_logs;
//         returns 'payer_confirmed' (highest confidence path)
//       * evidenceType='screenshot_ocr': validates OCR'd amount and payee VPA against expected;
//         stores screenshot + OCR payload; returns 'payer_confirmed' on success
//       * evidenceType='manual_entry': server cross-validates UTR format and expected amount/VPA only;
//         lowest confidence; flagged for admin review
//   - submitReceiverAttestation: on 'received' → payment_intent moves to auto_verified;
//                                on 'not_received' → opens dispute;
//                                on 'retracted' (within 24h of received attestation) → admin queue
//
// Phase 2 implementation: CashfreeVerificationProvider
//   - verifyUpiId: Cashfree Penny Drop API (₹2/check) — replaces OCR as primary
//   - verifyTransaction: Cashfree UTR Recon API (₹1/lookup) — adds authoritative verification
//   - submitPayerEvidence + submitReceiverAttestation: kept as fallback when verifyTransaction returns "not found within 30 min"

// IPaymentProvider — money movement (Phase 3 primary)
interface IPaymentProvider {
  createCollectionLink(input: CreateCollectionInput): Promise<CollectionLink>;
  createDisbursement(input: DisbursementInput): Promise<DisbursementReceipt>;
  getTransactionStatus(externalRef: string): Promise<TransactionStatus>;
  registerWebhook(handler: WebhookHandler): void;
}
// Phase 1 implementation: NoOpPaymentProvider — we never move money; verification is via IPaymentVerificationProvider
// Phase 2 (optional): CashfreePaymentLinkProvider for fallback collection
// Phase 3 implementation: CashfreeEscrowProvider or partner NBFC-P2P escrow

// IKycProvider — identity verification
interface IKycProvider {
  submitKycDocs(input: KycSubmissionInput): Promise<KycSubmissionResult>;
  fetchKycStatus(userId: string): Promise<KycStatus>;
  verifyPan(pan: string, name: string): Promise<PanVerificationResult>;
  verifyBankAccount(accNum: string, ifsc: string): Promise<BankVerificationResult>;
  verifySelfieLiveness(imageBytes: Buffer, referencePhotoUrl?: string): Promise<LivenessResult>;
}
// Phase 1 implementation: ManualKycProvider — files uploaded to Cloudinary, marked verified by admin
// Phase 2 implementation: composite of DigiLockerKycProvider + CashfreePennyDrop + HypervergeLiveness + PanOcrProvider

// IAgreementProvider — legal contract generation + signing
interface IAgreementProvider {
  generate(input: AgreementInput): Promise<AgreementArtifact>;
  recordAcceptance(input: AcceptanceInput): Promise<AcceptanceRecord>;
  fetchSigned(agreementId: string): Promise<SignedArtifact>;
}
// Phase 1 implementation: ClickwrapAgreementProvider — PDFKit + IP/device/timestamp log + SHA-256 hash
// Phase 2 implementation: DigioESignProvider

// INotificationProvider — outbound user comms (composite)
interface INotificationProvider {
  send(input: NotificationInput): Promise<NotificationReceipt>;
}
// Phase 1 implementation: composite of InAppProvider + ResendEmailProvider
// Phase 2 implementation: add WhatsAppBusinessProvider + Msg91SmsProvider

// IReportingProvider — regulator/audit reporting
interface IReportingProvider {
  emitAuditEvent(event: AuditEvent): Promise<void>;
  exportPeriodicReport(input: ReportRequest): Promise<ReportArtifact>;
}
// Phase 1 implementation: MongoAuditReportingProvider — writes to audit_logs collection
// Phase 3 implementation: composite of MongoAuditReportingProvider + RbiQuarterlyReportProvider

// IAccountAggregatorProvider — bank/UPI alt-data
interface IAccountAggregatorProvider {
  initiateConsent(input: ConsentInput): Promise<ConsentHandle>;
  fetchData(consentId: string): Promise<AaDataBundle>;
}
// Phase 1: NoOpAaProvider (interface reserved; not callable)
// Phase 2: SetuAaProvider (via partner sponsored-FIU)

// IFraudProvider — fraud signal computation
interface IFraudProvider {
  computeSignals(input: FraudContext): Promise<FraudSignals>;
  reportConfirmedFraud(input: ConfirmedFraudInput): Promise<void>;
}
// Phase 1: RuleBasedFraudProvider — simple velocity/device rules (mostly informational, admin reviews)
// Phase 3: composite with vendor (Bureau / IDfy / Hyperverge fraud)
```

Every domain use-case takes these as constructor dependencies (DI container is `tsyringe`). Swapping in Phase 2/3 is a single line in the composition root.

### 6.3 The Phase 1 payment verification flow in detail (zero-cost, OCR-automated)

This is the most important new flow versus v0.1, so it gets its own subsection.

#### 6.3.1 The OCR pipeline

Tesseract.js runs **client-side in the browser** (Wasm-based, ~3MB initial download, cached after first load). Every screenshot the user uploads goes through this pipeline:

1. **Preprocessing** (browser): downscale to max 1600px on longest edge, convert to grayscale, increase contrast, deskew if tilted >2°. Done with HTML5 Canvas APIs.
2. **OCR** (browser): Tesseract.js with English language model. Returns full text + per-block confidence scores.
3. **Pattern extraction** (browser): regex over the OCR text to extract:
   - UTR: `/\b\d{12}\b/` (12-digit numeric sequences; we also accept 12-character alphanumeric for NEFT-style UTRs as fallback)
   - Amount: `/₹\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/` or `/\b(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s?(?:INR|Rs)/i`
   - VPA: `/\b[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}\b/`
   - Status: keyword match on "success", "successful", "paid", "completed", "failed"
4. **Confidence aggregation** (browser): weighted average of Tesseract per-block confidences for the blocks containing extracted patterns. Anything <0.65 flagged as low confidence.
5. **Submission** (to server): screenshot uploaded to Cloudinary; OCR extraction payload (raw text + extracted fields + confidence + engine version) submitted via API.
6. **Server-side validation**: server re-checks pattern extraction against the raw text (defends against client tampering with extraction values); cross-validates extracted amount and payee VPA against the `payment_intent`'s expected values; computes match decision.

If the user's device is too old or Wasm unsupported (rare), the client transparently falls back to server-side Tesseract via Render.

#### 6.3.2 Onboarding UPI verification

1. User completes profile and uploads KYC docs (Aadhaar front + back, PAN front, selfie video).
2. User types their primary UPI ID (e.g., `bhagirath@oksbi`). App validates basic VPA syntax client-side.
3. App shows an annotated guide: "Open your UPI app → Tap your profile → Take a screenshot of the page that shows your name and UPI ID together." Includes example screenshots for GPay, PhonePe, Paytm, BHIM.
4. User uploads the screenshot. OCR pipeline runs in browser.
5. App displays extraction preview: "We found UPI ID `bhagirath@oksbi` and name `Bhagirath Sheela`. Confirm and submit?" User can retake if wrong.
6. On submit, screenshot uploaded to Cloudinary; backend receives extraction payload.
7. Server runs:
   - Exact match: typed VPA == OCR-extracted VPA?
   - Fuzzy match: OCR-extracted name vs KYC name (Levenshtein or token-based, threshold 0.80)
   - Confidence check: OCR confidence ≥ 0.65?
8. **All three pass** → `upi_registrations` row created with `isPrimary: true, verificationMethod: 'ocr_screenshot_auto', verifiedAt: now, ocrConfidence: X, extractedName: Y`. User proceeds to KYC review for Aadhaar/PAN (which still requires human review).
9. **Any check fails** → UPI screenshot added to admin queue. Admin reviews and overrides.
10. Aadhaar + PAN + selfie video are reviewed by admin in same queue pass.

Total admin time per user with high-confidence OCR: ~1 minute (just Aadhaar/PAN check). With low-confidence OCR: ~2 minutes (plus UPI screenshot).

#### 6.3.3 Loan disbursement (lender → borrower) — native Intent primary, OCR fallback

**Why Android RN native Intent is the primary path**

The NPCI UPI Intent spec defines that the UPI app returns structured data to the calling Android app via Intent Result: `Status`, `txnRef` (the 12-digit UTR), `Amount`, `ApprovalRefNo`, `responseCode`, etc. When TrustPe is a React Native Android app firing `startActivityForResult`, we receive this return data **directly and reliably** — no screenshot needed, no OCR ambiguity, no per-app UTR labeling confusion.

The screenshot+OCR path (v0.5 design) is kept only as a fallback for:
- UPI apps that return incomplete data (rare, mostly old versions or some OEM apps)
- iOS users in Phase 2 (URL Scheme handoff doesn't return structured data the same way)
- Diagnostic / dispute evidence (we still let users attach a screenshot voluntarily)

Receiver side stays as single-tap attestation — the lender's Intent return data is the authoritative payer-side evidence; the borrower just confirms receipt.

**Step by step — happy path:**

1. Lender taps "Disburse Now" in the RN app.
2. Backend creates a `payment_intent` row with status `awaiting_payer_evidence`, fields: `loanId`, `payerUserId: lender.id`, `payeeUserId: borrower.id`, `payerVpa: lender.primaryVpa`, `payeeVpa: borrower.primaryVpa`, `amountPaise`, `note: "TRUSTPE-<loanId-short>"`, `expectedNotBefore: now`, `expiresAt: now+48h`.
3. RN constructs the UPI Intent: `Intent(ACTION_VIEW)` with `Uri.parse("upi://pay?pa=<borrower.vpa>&pn=<borrower.name>&am=<amount>&tn=<note>&cu=INR")` and category `BROWSABLE`.
4. RN fires `startActivityForResult(intent, REQUEST_CODE)`. Android shows the UPI-app chooser.
5. Lender picks their UPI app (GPay / PhonePe / Paytm / BHIM / etc.) and completes payment inside that app.
6. UPI app calls back to TrustPe with `Intent.ACTION_RESULT` containing the standardized return string:
   `Status=SUCCESS&txnRef=481209831245&txnId=GP-abc123&Amount=15000.00&ApprovalRefNo=12345&responseCode=00`
7. RN's `onActivityResult` handler parses the return string into structured fields.
8. RN calls backend `submitPayerEvidence({ paymentIntentId, evidenceType: 'native_intent', intentReturn })`.
9. Server validates:
   - `Status === 'SUCCESS'`
   - `responseCode === '00'`
   - Numeric `Amount` matches `payment_intent.amountPaise` (allow small rounding tolerance)
   - `txnRef` matches 12-digit UTR pattern
   - Stores full raw Intent return in `audit_logs`
10. **All checks pass** → `payment_intent` → `payer_confirmed` automatically. **No screenshot, no OCR, no user typing.**
11. Push notification dispatched to borrower via Expo Push Service: "Lender has paid ₹15,000 for your loan. Please confirm you received it."

**Step by step — fallback when Intent return is incomplete:**

12. If `Status === 'SUBMITTED'` (some apps return this when the transaction is queued but not yet confirmed), RN polls the backend for a status update for 60 seconds. If still no resolution, prompts user: "Your UPI app returned 'Submitted' status. Please take a screenshot of the payment-success page once it shows and upload it."
13. If `Status === 'SUCCESS'` but `txnRef` is missing or malformed, RN prompts for screenshot upload as supplementary evidence.
14. If no Intent return at all (rare — happens when user backs out of UPI app without completing, or app crashes), RN shows a screen: "Did you complete the payment? Take a screenshot of the success page if you did, or tap 'I didn't pay yet'."
15. Screenshot path proceeds as in v0.5 §6.3 (OCR pipeline, per-app guides §6.3.5).

**Borrower attestation (single tap):**

16. Borrower opens the loan screen in the RN app. Sees a card showing: lender's name, amount, the UTR (from Intent return or OCR-extracted from screenshot in fallback case), and any optional screenshot the lender attached.
17. Three action buttons:
    - **"Yes, I received it"** — primary green button → backend `submitReceiverAttestation({ attestation: 'received' })` → `payment_intent` → `auto_verified`. Loan moves to `ACTIVE`. EMI schedule generated. Push notifications fire to both.
    - **"Let me check first"** — collapses the card; sets a reminder. Helper text suggests where to look (bank SMS inbox, UPI app's "History" tab, bank app balance).
    - **"I did not receive it"** — text link → opens dispute flow with reason field → `payment_intent` → `disputed_by_payee` → admin queue.
18. Optional: "Attach my bank SMS or UPI screenshot too" link inside the confirm card — borrower uploads evidence even when confirming. No OCR matching is performed; the file is just attached to the audit log for dispute support.
19. **24-hour retraction window**: after tapping "Yes, I received it," a banner persists on the loan screen for 24h: "Confirmed receipt at 14:32. If this was a mistake, you can retract within 24 hours." Tap retracts → `payment_intent` → `confirmation_retracted_review` → admin queue.

**Timeouts and reminders:**

- Borrower no response after 24h → push + email reminder
- After 36h → second reminder
- After 48h → third reminder
- After 72h → admin queue entry "borrower non-responsive"; admin contacts borrower directly; lender's Intent return + (if any) screenshot evidence is used for resolution
- Borrower's TrustScore lightly penalized for non-response over 72h (recoverable)

#### 6.3.4 EMI payment (borrower → lender) — symmetric reverse

Same flow with roles swapped. Borrower fires UPI Intent from RN, native Intent Result returns structured payment data (or screenshot+OCR fallback if Intent return is incomplete). Lender attests with single-tap "Yes, received" button. Same 24h retraction window and dispute paths.

#### 6.3.5 UI guidance — per-UPI-app screenshot capture

This is critical to OCR success rate. Each UPI app shows the UTR under a different label and on a different screen. TrustPe's upload guide shows annotated images for each major app.

| UPI App | Capture screen | Field to identify | Common mistake to avoid |
|---|---|---|---|
| **Google Pay** | Payment-success page → scroll to "Transaction details" expandable section | **"Bank Reference ID"** (12-digit numeric, this IS the UTR) | Do NOT use "Transaction ID" — that's GPay's internal alphanumeric, not the UTR |
| **PhonePe** | Payment success page → bottom of receipt card | "UPI Reference No." (12-digit) | None — clearly labeled |
| **Paytm** | Success page → "View details" expand | "UPI Ref No" (12-digit) | Do NOT use "Order ID" |
| **BHIM** | Success page → directly visible | "UTR" or "Transaction Ref ID" (12-digit) | None |
| **Amazon Pay** | Success page → "Order details" expand | "UPI Reference ID" (12-digit) | None |
| **CRED** | Success page → bottom of receipt | "UPI Reference Number" (12-digit) | None |
| **WhatsApp Pay** | Chat receipt of the payment | "UPI Transaction ID" (12-digit) | None |
| **Bank SMS (any bank)** | Inbox SMS from VK-/JD-/AX-/AD- sender | 12-digit number near "UPI" / "Ref" keyword | Format varies by bank — guide image per major bank shown |

TrustPe's app-selection step auto-narrows the guide to the user's chosen app. OCR pattern matching uses the same 12-digit regex regardless of label, so the label variation doesn't matter for extraction — but the **screen** the user captures absolutely matters, and that's what the guide enforces.

#### 6.3.6 Why this is robust

- **Source authority**: When the happy-path native Intent Result is used, the UTR comes directly from the UPI app (issued by NPCI through the lender's bank PSP). The client cannot fabricate this without an actual transaction having occurred.
- **Server-side validation**: Server cross-validates Intent return `Amount` against `payment_intent.amountPaise`, checks `responseCode === '00'`, and verifies `txnRef` matches a 12-digit UTR pattern. A mismatched or malformed return is flagged immediately.
- **OCR tamper resistance (fallback path)**: When OCR is used, server re-runs regex extraction on the raw OCR text submitted by the client. A malicious client cannot claim "OCR said the amount was ₹50K" if the screenshot's raw text shows ₹5K.
- **Receiver attestation creates accountability**: borrower's tap is logged in `audit_logs` with timestamp, IP, device fingerprint, and biometric-unlock confirmation timestamp. Both retraction and dispute paths are explicit, time-bounded, and audited.
- **Friends-and-family Phase 1 scale + social trust + 24h retraction window** together make the cost of accidentally confirming a non-existent payment very low; the cost of intentionally confirming a non-existent payment is high (TrustScore impact, public default registry entry, social consequences).

#### 6.3.7 Expected admin load at Phase 1 scale

- 30–50 users × ~3 payments per loan × ~40 loans/quarter = ~120 payments/quarter
- Expected native-Intent success rate: **~95%** on Android (all major UPI apps return structured data reliably; rare partial returns trigger OCR fallback)
- OCR fallback success rate on the remaining ~5%: ~90%
- Receiver attestation rate within 48h: ~95% (friends pilot, social pressure)
- Admin handles: ~6 payer Intent/OCR exceptions + ~6 receiver non-responses per quarter = ~12 exceptions/quarter
- Each exception ~3 minutes
- Total admin payment-verification time: **~40 minutes per quarter**
- Total cost: ₹0

#### 6.3.8 Upgrading to paid API in Phase 2

When budget allows in Phase 2, the same `IPaymentVerificationProvider` interface accepts a `CashfreeVerificationProvider` implementation. Cashfree's UTR Recon authoritatively verifies the transaction against NPCI records server-side, providing a third corroboration of the Intent return data. Native Intent + Cashfree-confirmed = full automation; receiver can get a passive "payment auto-verified" notification instead of an action prompt in those cases. The OCR + attestation paths remain as fallbacks. Zero refactoring; flip a single line in the composition root.

### 6.4 Where each requirement from your spec lands

| Spec item | Layer | Module |
|---|---|---|
| User Registration/Login | Interface + App | `routes/auth.ts`, `usecases/auth/*` |
| Aadhaar Validation | App + Adapter | `usecases/kyc/SubmitKyc`, `adapters/kyc/ManualKycProvider` |
| KYC | App + Adapter | `usecases/kyc/*` |
| Bank linking | App + Adapter | `usecases/kyc/CaptureBank`, `usecases/kyc/VerifyUpi` |
| Profile health scoring | Domain | `domain/trust/HealthEngine` |
| Public reputation | Domain + App | `domain/trust/Reputation`, `routes/profile.ts` |
| Loan listings | App | `usecases/loans/Browse*` |
| Loan negotiation | App + Domain | `usecases/loans/MakeOffer`, `usecases/loans/CounterOffer` |
| Loan agreements | App + Adapter | `usecases/agreement/Generate`, `adapters/agreement/Clickwrap` |
| Selfie verification | App + Adapter | `usecases/kyc/SubmitSelfie` |
| EMI tracking | Domain | `domain/loan/EmiSchedule` |
| UPI-verified payments | App + Adapter | `usecases/payment/Initiate`, `usecases/payment/SubmitPayerEvidence`, `usecases/payment/SubmitReceiverAttestation`, `adapters/payment/AsymmetricOcrAttestationProvider` (Phase 1) / `adapters/payment/CashfreeVerificationProvider` (Phase 2+); browser OCR module in `apps/web/src/lib/ocr/`; per-UPI-app capture guides in `apps/web/src/components/domain/UpiCaptureGuide` |
| Part payments + pre-closure | Domain | `domain/loan/Repayment` |
| Penalty calc | Domain | `domain/loan/PenaltyPolicy` |
| Public reviews | App | `usecases/review/*` |
| Real-time chat | Interface + App | `socket/chat.ts`, `usecases/chat/*` |
| Admin panel | App + Interface | `usecases/admin/*`, `routes/admin/*` |
| Fraud detection | Adapter | `adapters/fraud/RuleBased` |
| Notifications | App + Adapter | `usecases/notify/*`, `adapters/notify/*` |
| Dispute resolution | Domain + App | `domain/dispute/*`, `usecases/dispute/*` |
| Loan history | App | `usecases/loans/History` |
| Public default status | Domain | `domain/trust/DefaultRegistry` |
| Loan expiry | Domain + Worker | `domain/loan/Expiry`, `workers/loanExpirySweeper` |
| Progressive eligibility | Domain | `domain/trust/EligibilityLadder` |

---

## 7. Frontend architecture

Phase 1 has two distinct frontend apps with different stacks for very different audiences:

- `apps/mobile/` — **React Native (Expo)** Android app for end users (lenders + borrowers)
- `apps/admin/` — **Next.js** web app for the founder/admin (you)

They share business logic (zod schemas, domain types, validators) through `packages/core`. They do NOT share UI primitives in Phase 1 — RN uses React Native components, Next.js admin uses Tailwind-styled HTML. A shared `packages/ui` is deferred until we have iOS RN + a Phase 2 public Next.js site that would benefit from sharing.

### 7.1 RN user app — screen structure

Expo Router file-based routing (`apps/mobile/app/`):

```
apps/mobile/app/
├── (auth)/
│   ├── invite.tsx          # Enter invite code
│   ├── signup.tsx          # Phone + email + basic info
│   ├── verify-otp.tsx      # Email OTP
│   └── biometric-setup.tsx # Optional: enable fingerprint unlock
├── (onboarding)/
│   ├── profile.tsx         # Name, photo, occupation, city, declared income
│   ├── kyc-aadhaar.tsx     # Camera capture front+back
│   ├── kyc-pan.tsx
│   ├── kyc-selfie.tsx      # 5-sec selfie video
│   ├── upi-setup.tsx       # Type VPA + capture UPI app screenshot
│   └── pending-review.tsx  # Waiting on admin approval
├── (app)/
│   ├── home.tsx            # Dashboard: active loans, pending actions, TrustScore badge
│   ├── borrow/
│   │   ├── new.tsx         # Create loan request
│   │   └── [requestId].tsx # Manage own request, see offers
│   ├── lend/
│   │   ├── browse.tsx      # Browse open requests
│   │   └── offer/[id].tsx  # Make/manage offer
│   ├── loans/
│   │   ├── [loanId].tsx          # Active loan detail (chat + EMI schedule)
│   │   ├── [loanId]/pay.tsx      # UPI Intent flow (lender disburse or borrower EMI)
│   │   ├── [loanId]/confirm.tsx  # Receiver attestation screen
│   │   └── [loanId]/agreement.tsx # PDF viewer for the signed agreement
│   ├── chat/[threadId].tsx
│   ├── disputes/
│   └── settings/
└── _layout.tsx             # Root: auth gate, theme, notifications init
```

### 7.2 RN user app — key patterns

- **TypeScript strict mode** end-to-end.
- **Forms**: React Hook Form + Zod resolver. Zod schemas imported from `packages/core` (identical to backend validation).
- **Server state**: TanStack Query. Background refetch on app focus, optimistic updates on mutations.
- **Local state**: `useState` / `useReducer`. No Zustand or Redux in Phase 1.
- **Auth**: access token in memory + refresh token in Expo SecureStore. Auto-refresh interceptor on the API client.
- **Biometric unlock**: optional gate on app open after first successful login. Uses Expo LocalAuthentication.
- **Push notifications**: Expo Push tokens registered with backend on login. Notification handlers route to deep links.
- **UPI Intent module**: native bridge that fires `startActivityForResult` and parses Intent return. Module under `apps/mobile/modules/upi-intent/`.
- **OCR module**: Tesseract via JS bridge (`react-native-tesseract-ocr` for Android). Module under `apps/mobile/modules/ocr/`. Only loaded when needed (fallback path).
- **Realtime**: `socket.io-client` for chat and live loan state. Reconnects on network change.
- **OTA updates**: Expo Updates for non-native code; rebuild required only for native module changes.
- **Accessibility**: all interactive components have `accessibilityLabel` + `accessibilityRole`. TalkBack tested.

### 7.3 RN user app — component organization

```
apps/mobile/components/
├── primitives/      # Button, Input, Card, Sheet — RN-flavored
├── forms/           # Composed form fields with RHF integration
├── domain/          # LoanCard, OfferCard, TrustScoreBadge, UpiCaptureGuide
├── layout/          # AppShell, BottomTabs, Header
└── feedback/        # Toast, Alert, EmptyState, LoadingState
```

Domain components import zod schemas and types from `packages/core` so the same shape used in the backend renders here.

### 7.4 Admin panel (Next.js)

`apps/admin/` runs the existing admin design described in §8. It is a separate Next.js app under a different Vercel project. In Phase 1 it sits behind Vercel Access password protection (no public access), uses admin-scoped JWT, and is the only web frontend in the codebase. All Phase 1 admin actions (KYC review, dispute resolution, payment-exception handling, default outreach) happen here.

The admin panel does NOT import from `packages/ui` (which doesn't exist in Phase 1); it ships its own Tailwind components. When `packages/ui` is created in Phase 2 (for the public Next.js site + admin to share), the admin migrates incrementally.

---

## 8. Admin panel architecture

The admin panel is a separate Next.js app (`apps/admin`) deployed to a different Vercel project. In Phase 1 it lives at a non-public domain (e.g., `admin-trustpe.vercel.app` behind Vercel Access password) and only you have access.

### 8.1 Why separate from main app

- Different auth model (admin session + 2FA mandatory, IP allowlist, shorter session)
- Smaller bundle (no public landing pages, no marketing CSS)
- Different access pattern (only TrustPe staff)
- Independent deploy cadence

It shares the same backend API but uses admin-scoped JWT claims.

### 8.2 Admin modules (Phase 1 — you-only)

| Module | Capabilities |
|---|---|
| User management | List, search, view profile, suspend, reset password, force logout |
| KYC review | Queue, approve/reject with reason, request more info, view uploaded Aadhaar/PAN/selfie video |
| UPI verification queue | Pending UPI penny-drop name mismatches |
| Loan monitoring | All loans with state filter, drill into any loan |
| **Payment exception queue** | **Payments where UTR auto-verify failed; admin manually verifies via Cashfree dashboard or contacts user** |
| Dispute resolution | Dispute queue, evidence review, decision, action |
| Default outreach | Defaulted-loan list with contact details + message templates |
| Profile health | Anyone's score with breakdown by factor, force recompute |
| Review moderation | Reported reviews, hide/restore |
| Notifications | Manual broadcast to user/segment, template management |
| Reports | Export CSV: users, loans, defaults, revenue |
| Feature flags | Toggle features per environment / user segment |
| Audit log viewer | Filterable by actor, entity, action, date range |

### 8.3 Admin RBAC (Phase 1 = one role)

Phase 1: single `super_admin` role (you). Schema reserves the other roles for Phase 2.

Phase 2 roles:

| Role | Read | Write |
|---|---|---|
| `super_admin` | everything | everything |
| `compliance` | everything | KYC approve/reject, AML flag, freeze |
| `finance` | money + loans | money confirmations, manual adjustments |
| `support` | users + loans + chats | suspend user, resolve dispute |
| `admin` | users + loans | basic CRUD on flag-controlled scopes |

Every admin write is audit-logged with the admin's user ID, IP, and the diff.

---

## 9. API design (overview)

Full spec lives in `API_DESIGN.md`. This section captures the conventions everything follows.

### 9.1 Conventions

- **Base URL:** `https://api.trustpe.in/v1` (versioned; never break v1 once a single external integrator depends on it)
- **Auth header:** `Authorization: Bearer <access-token>` for non-cookie clients. Web app uses httpOnly refresh-token cookie + Authorization header on the access token (stored in memory).
- **Error envelope:**
  ```json
  { "ok": false, "error": { "code": "loan.offer.expired", "message": "Offer expired", "details": {} }, "traceId": "..." }
  ```
- **Success envelope:**
  ```json
  { "ok": true, "data": { ... }, "meta": { "page": 1, "total": 42 } }
  ```
- **Money-touching endpoints** (`/payments/*`, `/loans/*/disburse`, etc.) require `Idempotency-Key` header (UUID). Server stores key+response for 24h. Replay returns cached response.
- **Pagination:** cursor-based (`?cursor=...&limit=20`), not offset.
- **Rate limits:** per-IP and per-user, three tiers — public (60 req/min), authenticated (300 req/min), money-write (5 req/min). Headers `X-RateLimit-*` always included.
- **Request validation:** zod schemas, errors returned in field-level `details`.
- **Date format:** ISO 8601 UTC. Client renders in IST.
- **Money:** integer **paise** everywhere on the wire. Never floats. `amountPaise: 1500000` not `amount: 15000.00`.

### 9.2 Resource surface (high level)

```
/auth/signup
/auth/login
/auth/verify-otp
/auth/refresh
/auth/logout

/me                     GET current user
/me/profile             PATCH profile
/me/kyc                 POST/GET KYC workflow
/me/upi                 POST register UPI (triggers penny drop) / GET status
/me/devices             GET sessions, DELETE session
/me/notifications       GET feed, PATCH read

/u/:handle              GET public profile

/loan-requests          POST create / GET search
/loan-requests/:id      GET / PATCH / DELETE
/loan-requests/:id/offers POST make offer / GET list
/loan-offers/:id        GET / PATCH (counter) / POST accept / POST reject

/loans                  GET list (mine)
/loans/:id              GET detail
/loans/:id/agreement    GET signed PDF
/loans/:id/emis         GET schedule
/loans/:id/disburse     POST (lender initiates UPI flow, returns deep link payload)
/loans/:id/payments     POST record payment (with UTR) / GET list
/loans/:id/preclose     POST request pre-closure
/loans/:id/disputes     POST open / GET list

/payments/:id/verify    POST (manual UTR re-verify; rate-limited)

/reviews                POST (after loan closure)
/reviews/:id            GET / PATCH / DELETE (own)

/chat/threads           GET list
/chat/threads/:id       GET messages
/chat/threads/:id/messages POST send (also via socket)

/disputes               GET mine / POST open
/disputes/:id           GET / PATCH (add evidence)

/admin/*                Admin-scoped endpoints (separate auth)
```

Full request/response shapes in `API_DESIGN.md`.

### 9.3 Socket.io events

Namespace `/realtime`, rooms named `loan:<loanId>` and `dispute:<disputeId>`.

| Event | Direction | Payload |
|---|---|---|
| `chat:message` | C→S | `{ threadId, body, attachments[] }` |
| `chat:message` | S→C | `{ id, threadId, sender, body, attachments[], at }` |
| `chat:typing` | C→S | `{ threadId, isTyping }` |
| `chat:typing` | S→C | `{ threadId, userId, isTyping }` |
| `chat:read` | C→S | `{ threadId, upTo }` |
| `chat:read` | S→C | `{ threadId, userId, upTo }` |
| `loan:state` | S→C | `{ loanId, state, at }` |
| `payment:verified` | S→C | `{ paymentId, loanId, at }` |
| `notify:push` | S→C | `{ id, kind, title, body, link }` |

Server authenticates the socket via the same JWT (passed in `auth.token` on connect). Every event passes through a per-event validator and per-room authorization check.

---

## 10. Authentication and session management

### 10.1 Phase 1 signup flow

Phase 1 is invite-only by **APK distribution**, not by an in-app invite code. Friends-and-family install the APK from a private Expo internal-distribution link the founder shares. Admin still gates account activation via KYC approval.

1. User opens app for the first time, taps **Get started**, lands on signup.
2. User enters phone number + email + name.
3. Server generates 6-digit OTP, TTL 5 min, stores hash in the OTP store (in-memory in Sprint 1, Redis from Sprint 3).
4. OTP delivered via **email** (Resend). Phase 2 adds WhatsApp + SMS.
5. User submits OTP. Server verifies, creates `users` row with `status: 'unverified'`, returns access + refresh tokens.
6. User completes profile (name, photo, city, declared occupation/income, declared monthly lending capacity if intends to lend).
7. User starts KYC (capture Aadhaar front + back + PAN front + selfie video).
8. User registers UPI ID (types VPA + uploads UPI app screenshot for OCR auto-verification).
9. Admin reviews KYC + UPI screenshot.
10. On approval, user is fully active and lands on the home dashboard.

### 10.2 Token model

- **Access token:** JWT, 15 min TTL, signed with HS256 + rotating secret stored in env. Claims: `sub`, `roles[]`, `kycStatus`, `iat`, `exp`.
  - **RN user app**: stored in memory only; never persisted. App reloads or background-kill requires a refresh exchange.
  - **Admin web app**: stored in memory; never written to localStorage.
- **Refresh token:** opaque random 256-bit, 30 day TTL.
  - **RN user app**: stored in **Expo SecureStore** (Android Keystore-backed encrypted storage). Read on app launch to obtain a new access token.
  - **Admin web app**: stored in **httpOnly+Secure+SameSite=Lax** cookie set by the backend.
- Server-side: hash of every active refresh token kept in `refresh_tokens` collection with device fingerprint and rotation chain. Single-use — refreshing returns a new token, old one is revoked. If a revoked token is replayed, the whole chain is killed (likely theft); user is logged out everywhere and notified.
- **Logout-all:** revokes the chain root, kills all device sessions.
- **2FA for admins:** TOTP via authenticator app, mandatory. RN user app does not have 2FA in Phase 1 (relies on biometric unlock instead); Phase 2 adds optional TOTP for users.
- **Biometric unlock (RN only):** after first successful login on a device, user is prompted to enable biometric unlock. When enabled, opening the app prompts for fingerprint/face before exposing the refresh token to the API client. Implementation: `expo-local-authentication` gate before reading SecureStore.

### 10.3 Device + IP logging

Every login records a `device_sessions` row: device fingerprint (FingerprintJS open-source or self-hosted variant), IP, geo (best-effort from IP), user agent, last-seen, OS, browser. Profile health uses **device consistency** as a positive signal and flags sudden multi-country logins as a fraud signal.

---

## 11. Database — overview and indexing

Full per-collection schema in `SCHEMAS.md`. This section is the strategy.

### 11.1 Collection inventory

| Collection | Purpose | Approx record size | Expected at 50 users (Phase 1) |
|---|---|---|---|
| `users` | Identity + minimal profile | 2 KB | 50 |
| `profiles` | Rich profile (separate to keep `users` small) | 5 KB | 50 |
| `kyc_records` | Per-user KYC docs and verification state | 10 KB | 50 |
| `upi_registrations` | Verified primary VPAs | 1 KB | 50 |
| `device_sessions` | Active + historical sessions | 1 KB | 250 |
| `invites` | Invite codes | 0.5 KB | 100 |
| `vouches` | Community vouching graph (schema reserved) | 0.5 KB | 0 in Phase 1 |
| `loan_requests` | Open requests | 3 KB | 100 |
| `loan_offers` | Offers/counters on requests | 2 KB | 300 |
| `loans` | Active + closed loans | 5 KB | 40 |
| `emi_schedules` | Per-loan EMI rows | 1 KB × N | 150 |
| `payment_intents` | Outstanding payment intents | 2 KB | 200 |
| `payments` | Confirmed payments (with UTR) | 2 KB | 150 |
| `agreements` | Signed contract records | 3 KB | 40 |
| `reviews` | Post-loan reviews | 1 KB | 80 |
| `chat_threads` | One per loan (and per dispute) | 0.5 KB | 50 |
| `messages` | Chat messages | 0.5 KB | 5,000 |
| `disputes` | Disputes | 5 KB | 5 |
| `notifications` | In-app feed | 0.5 KB | 2,000 |
| `audit_logs` | Append-only event log | 1 KB | 10,000 |
| `health_snapshots` | TrustScore history | 1 KB | 2,000 |
| `feature_flags` | Runtime configuration | 0.5 KB | 50 |

### 11.2 Indexing strategy

Every collection has the indexes below at minimum. Composite indexes are ordered by Equality–Sort–Range per Mongo best practice.

| Collection | Indexes |
|---|---|
| `users` | `{ phone: 1 }` unique, `{ email: 1 }` unique sparse, `{ handle: 1 }` unique, `{ status: 1, createdAt: -1 }` |
| `profiles` | `{ userId: 1 }` unique, `{ city: 1, trustScore: -1 }`, text index on `{ name, occupation, bio }` |
| `kyc_records` | `{ userId: 1 }` unique, `{ status: 1, submittedAt: 1 }` (admin queue) |
| `upi_registrations` | `{ userId: 1, isPrimary: 1 }` partial-unique where `isPrimary: true`, `{ vpa: 1 }` unique (globally), `{ verificationMethod: 1, verifiedAt: -1 }` for admin queries; fields include `extractedName`, `ocrConfidence`, `nameMatchesKyc`, `verificationMethod` enum (`ocr_screenshot_auto` / `admin_manual` / `reverse_penny_drop` / `cashfree_penny_drop`) |
| `loan_requests` | `{ borrowerId: 1, status: 1, createdAt: -1 }`, `{ status: 1, city: 1, amountPaise: 1, createdAt: -1 }`, TTL on `expiresAt` |
| `loan_offers` | `{ requestId: 1, status: 1 }`, `{ lenderId: 1, status: 1, createdAt: -1 }` |
| `loans` | `{ borrowerId: 1, status: 1 }`, `{ lenderId: 1, status: 1 }`, `{ status: 1, nextEmiDueAt: 1 }` (cron lookups) |
| `emi_schedules` | `{ loanId: 1, sequence: 1 }`, `{ status: 1, dueAt: 1 }` (cron) |
| `payment_intents` | `{ status: 1, expiresAt: 1 }`, `{ loanId: 1 }`, TTL on `expiresAt` |
| `payments` | `{ loanId: 1, at: -1 }`, `{ utr: 1 }` unique sparse, `{ status: 1, createdAt: -1 }` |
| `messages` | `{ threadId: 1, at: -1 }`, `{ senderId: 1, at: -1 }` |
| `notifications` | `{ userId: 1, readAt: 1, createdAt: -1 }` |
| `audit_logs` | `{ entityType: 1, entityId: 1, at: -1 }`, `{ actorId: 1, at: -1 }`, TTL 5 years on `at` |
| `health_snapshots` | `{ userId: 1, at: -1 }` |
| `device_sessions` | `{ userId: 1, lastSeenAt: -1 }`, `{ refreshTokenHash: 1 }` unique |
| `reviews` | `{ revieweeId: 1, createdAt: -1 }`, `{ loanId: 1, direction: 1 }` unique |

### 11.3 Transaction usage

MongoDB Atlas supports multi-document transactions on replica sets. We use them sparingly — only where state across multiple collections must be consistent:

- Accepting a loan offer (create `loan`, mark `loan_offers` accepted, mark sibling offers rejected, create `emi_schedules` rows, create `agreement`, create `chat_thread`, write `audit_logs`).
- Recording a verified payment (insert `payments`, update `emi_schedules` row, recompute `loans.outstandingPaise`, possibly close the loan, write `health_snapshots`, write `audit_logs`).
- KYC approval (update `kyc_records`, update `users.kycStatus`, recompute `health_snapshots`, write `audit_logs`).

Every other write is single-document and atomic by default.

---

## 12. TrustScore — the CIBIL-style profile health engine

Full pseudocode in `ENGINES.md §1`. Decision-level summary here.

### 12.1 What it produces

A single integer **TrustScore** from **300–900** per user, plus a **breakdown** showing the contribution of each factor. The breakdown is shown to the user so they understand how to improve their score — explicit anti-Faircent design choice.

### 12.2 The five bands

| Band | Range | Visual | Meaning |
|---|---|---|---|
| **Building** | 300–549 | Grey ring | New user; limited history. For first 30 days post-signup OR < 1 completed loan, this is the default band regardless of computed score. |
| **Fair** | 550–649 | Yellow ring | Default starting band after KYC + first loan attempt. |
| **Good** | 650–749 | Green ring | Eligible for T2 tier (₹25K cap) |
| **Very Good** | 750–849 | Dark green ring | Eligible for T3 tier (₹50K cap) |
| **Excellent** | 850–900 | Gold ring | Eligible for T4 tier (₹1L+ cap, Phase 3) |

New users start at score **550** after KYC approval (mid-Fair). It moves with every relevant event.

### 12.3 Factor weights (Phase 1 defaults — all in `feature_flags`, will be tuned with real data)

Scoring approach: each factor contributes a delta from a baseline of 550. Sum is clamped to [300, 900].

| Factor | Max delta | Range | Direction |
|---|---|---|---|
| KYC completeness | +60 | 0 to +60 | + |
| Successful loan count (capped at 20) | +180 | 0 to +180 | + |
| On-time EMI rate (last 12 EMIs) | +120 | 0 to +120 | + |
| Loan completion rate | +80 | 0 to +80 | + |
| Average review rating (amount-weighted) | +80 | 0 to +80 | + |
| Response time on offers + chat | +30 | 0 to +30 | + |
| Account age (months, capped at 24) | +30 | 0 to +30 | + |
| Device consistency | +20 | 0 to +20 | + |
| Selfie liveness recency | +15 | 0 to +15 | + (Phase 2+) |
| Default history | −250 | 0 to −250 | − |
| Dispute loss history | −100 | 0 to −100 | − |
| Late EMI count (last 12) | −80 | 0 to −80 | − |
| Failed requests / high rejection rate | −40 | 0 to −40 | − |
| Suspicious activity flag count | −200 | 0 to −200 | − |

Final score = clamp(550 + sum_of_deltas, 300, 900).

Anyone with a confirmed default in the last 365 days is capped at **549 (max Building band)** regardless of positives.

### 12.4 Trigger model

Score is recomputed (and a `health_snapshots` row appended) on these events:

- KYC status change
- Loan completed / defaulted
- EMI paid / missed / late
- Review received
- Dispute opened / resolved
- Suspicious activity flag added / cleared
- Daily cron at 02:00 IST (catches decay: account-age increments, response-time windows shifting)

Snapshots let the user see their score over time and let support investigate "why did my score drop."

### 12.5 Transparent breakdown shown to user

```
Your TrustScore: 712 (Good)

Why your score is where it is:
✓ KYC complete                              +60
✓ 3 successful loans                        +54
✓ On-time EMI rate: 100% (last 12)         +120
✓ Profile complete                          +30
✓ Account age: 5 months                     +6
⚠ 1 late EMI (gracious-period)              −8
                                          ─────
                                         + 262
                            Baseline:     550
                            ──────────────────
                            Your score:   712

What can lift you to "Very Good" (750+)?
• Complete 2 more loans on time            (+~24)
• Receive your first 5-star review         (+~16)
```

### 12.6 Lower-income trust signals beyond the spec

You asked for suggestions on signals appropriate to users without salary slips / GST / ITR. The schema reserves all of these in Phase 1 (off by default, flag-gated):

- **AA-derived signals (Phase 2+):** average bank balance over 6 months, inflow regularity, outflow patterns. Setu sponsored-FIU partnership.
- **UPI velocity (Phase 2+):** count and value of UPI transactions / month from declared UPI ID. From AA data.
- **Community vouching (Phase 2):** count and trust-score-weighted sum of active vouches. Vouchers stake their own score on the vouchee — if vouchee defaults, vouchers' scores drop by a configured amount.
- **Gig-platform attestations (Phase 2):** users link a Swiggy/Zomato/Ola/Uber screenshot or earnings export. Manual review in Phase 2, API integration when partners are willing.
- **Telecom tenure (Phase 3):** months on same mobile number (verified via TRAI Mobile Number Portability check API).
- **Utility bill stability (Phase 2):** uploaded electricity / rent bill, OCR'd, address verified against profile.
- **SHG / Jan Dhan account history (Phase 3):** self-declared in Phase 1/2, verified via partner integration in Phase 3.
- **Behavioral consistency (Phase 1 collect, Phase 2 score):** time-of-day login pattern, time-to-respond medians, profile edit frequency. Free to collect, weakly predictive but useful for fraud and gradually for score.

All of these contribute to the same TrustScore via additional weighted factors in `feature_flags`. We do **not** create a parallel scoring system — one score, many inputs.

---

## 13. EMI engine

Full pseudocode in `ENGINES.md §2`. Summary here.

### 13.1 Schedule generation

Given (principal, annualRate, tenureMonths, scheduleType, disbursalDate):

- `equated_monthly` — classic EMI formula `EMI = P × r × (1+r)^n / ((1+r)^n − 1)` where r = monthly rate. All instalments equal.
- `bullet` — single payment at end (rare; interface supports it for very short tenure).
- `interest_only_then_balloon` — monthly interest, principal at end (not in Phase 1 UI).

Default: `equated_monthly`. Due date is same calendar day of disbursal month + N. If that day doesn't exist (e.g., 31st in Feb), it shifts to last day of that month.

### 13.2 Partial payment handling

Partial = any payment less than the current outstanding-due amount.

Allocation order, configurable per loan but defaulting to:

1. Penalties (late fee, dispute fee) oldest first
2. Overdue interest
3. Current interest
4. Principal

Excess credit beyond current period is parked as `unallocatedCreditPaise` on the loan and applied automatically to the next EMI's due date arrival.

### 13.3 Late fee and penalty policy

All values in `feature_flags` (so we can tune without deploy):

- **Grace period:** 3 days. No fee within grace.
- **Late fee:** 2% of overdue EMI principal portion, per occurrence. Capped at ₹500 per EMI.
- **Penal interest:** 6% APR additional on the overdue principal until paid. Calculated daily.
- **Dispute escalation:** after 30 days overdue, loan moves to `disputed_overdue` state; admin reviews; if no remedy in 15 more days, loan moves to `defaulted`.

### 13.4 Pre-closure

User initiates pre-closure → server computes pre-closure quote (= current outstanding principal + accrued interest up to today + pre-closure penalty as % of remaining principal, default 2%) → user pays via standard UPI verify flow → loan closes → schedule rows for future periods cancelled → reviews opened.

### 13.5 Commission (platform's 3%)

Computed as 3% of **interest earned by lender** at the time interest is realized (not at disbursal). For Phase 1 (record-only payments), commission accrues as a `payable` row that lender owes the platform on monthly settlement — collected manually for now. In Phase 2/3 with payment integration, commission is split automatically at the EMI receipt level.

---

## 14. Loan lifecycle state machine

The single source of truth for what can happen to a loan and when. Full state diagram in `ENGINES.md §3`.

### 14.1 States

```
DRAFT
  ↓ submit
OPEN
  ↓ offer accepted              ↓ expire
NEGOTIATION                     EXPIRED (terminal)
  ↓ both sign
AGREEMENT_PENDING
  ↓ agreement signed by both
AWAITING_DISBURSAL
  ↓ lender initiates UPI + UTR verified
ACTIVE
  ├── on-time path → CLOSED (terminal) → review window → CLOSED_REVIEWED
  ├── partial late → ACTIVE_DELINQUENT → cured → ACTIVE
  ├── 30 days overdue → DISPUTED_OVERDUE
  │     ├── admin remedy → ACTIVE_DELINQUENT
  │     └── 15 more days → DEFAULTED (terminal)
  └── borrower pre-close → PRECLOSED (terminal) → review window
```

### 14.2 Guards and invariants

- Only an `OPEN` request can receive offers.
- Only the borrower can accept offers on their own request.
- An offer accepted moves the request to `NEGOTIATION` (or directly to `AGREEMENT_PENDING` if no counter-negotiation features are used).
- Sibling offers automatically rejected when one is accepted.
- A loan cannot enter `ACTIVE` until both parties have signed the agreement AND a payment for the principal has been UTR-verified.
- `DEFAULTED` is terminal and recorded in the public default registry.
- Transitions are persisted in `loan_state_transitions` collection (audit subset).

### 14.3 Why a state machine instead of booleans

Three reasons specific to fintech: (1) every transition is an audit event, (2) every transition can have side effects (notifications, health-score updates, scheduled jobs), (3) it makes invalid states unrepresentable.

Implementation: `xstate` (machine defined in `packages/core/src/domain/loan/loanMachine.ts`).

---

## 15. Progressive borrowing eligibility ladder

Tiers, unlock criteria, and caps. All in `feature_flags`. Reflects new CIBIL-style score thresholds.

| Tier | Borrow cap | Unlock criteria | Tenure cap |
|---|---|---|---|
| **T0 (new)** | ₹5,000 | KYC complete + invite code (Phase 1) | 30 days |
| **T1** | ₹10,000 | TrustScore ≥ 550 (Fair) + 1 successful loan ≥ ₹5K | 60 days |
| **T2** | ₹25,000 | TrustScore ≥ 650 (Good) + 3 successful loans + on-time rate ≥ 90% | 90 days |
| **T3** | ₹50,000 | TrustScore ≥ 750 (Very Good) + 5 successful loans + AA-verified bank inflow (Phase 2+) | 180 days |
| **T4 (Phase 3)** | ₹1,00,000 | TrustScore ≥ 850 (Excellent) + 10 successful loans + Compliance review | 180 days |

A user's effective cap is `min(tierCap, lender-side-cap-per-spec)`. Tier downgrades on default by one full tier (T3 → T2). A second default in 12 months drops by two tiers. A confirmed fraud flag drops to T0 indefinitely until cleared.

---

## 16. Dispute system

### 16.1 Dispute types

- Money not received (borrower opens, says lender didn't disburse)
- Payment not credited (lender opens, says borrower didn't pay)
- Agreement breach (either side, e.g., harassment in chat)
- Fraud claim (either side)
- Review dispute (subject of a review claims defamation)

### 16.2 Lifecycle

```
OPENED
  ↓ counterparty notified, 48h to respond
RESPONSE_AWAITED
  ↓ both parties added evidence
UNDER_REVIEW (admin queue)
  ↓ admin investigates (including pulling Cashfree records of any UTR-verified payments)
RESOLVED (with decision: borrower_favor | lender_favor | split | inconclusive)
```

### 16.3 Decision effects

| Decision | Effect |
|---|---|
| borrower_favor (money disbursal dispute) | Loan rolled back; lender's TrustScore hit |
| lender_favor (payment dispute) | EMI/loan marked unpaid; borrower's TrustScore hit; standard delinquency clock starts |
| split | Partial each, admin notes reasoning |
| inconclusive | No score change, but flag added to both for fraud-team review |

### 16.4 SLA targets

- First response from admin within 24 hours (Phase 1 — you respond personally)
- Resolution within 7 calendar days for standard disputes; 30 days for complex
- Escalation path to GRO with name + email + phone published in app footer (you are the GRO in Phase 1)

---

## 17. Fraud prevention

### 17.1 Phase 1 rule-based engine (in `RuleBasedFraudProvider`)

Each rule emits a signal with a confidence score. Signals are aggregated into a fraud score per user, separate from TrustScore. In Phase 1, signals are **informational** for admin (you) — no auto-block. Phase 2 turns on auto-block above thresholds.

Rules in Phase 1:

1. **Duplicate identity:** same phone, same Aadhaar last-4, same PAN, same selfie embedding (when available) across multiple `users` rows.
2. **Device clustering:** more than 3 distinct accounts logged in from the same device fingerprint in 30 days.
3. **IP clustering:** more than 5 accounts from the same /24 IP block in 7 days.
4. **Velocity:** more than 5 loan requests by same user in 24h. Same for offers from a lender.
5. **Geo-anomaly:** login from country/state inconsistent with declared address without prior travel signal.
6. **UPI ID mismatch:** payer/payee UPI in UTR lookup doesn't match registered UPIs.
7. **Repeat default pattern:** any account whose Aadhaar/PAN matches a previously-defaulted-and-fraud-flagged account.
8. **Repeated lender no-show:** lender accepts offer but fails to disburse within 48h, more than twice.
9. **Disposable phone:** phone number is in a known disposable-prefix range (CSV in `feature_flags`).

### 17.2 What we deliberately don't do in Phase 1

- Vendor fraud APIs (Bureau, IDfy) — expensive, deferred to Phase 3
- ML fraud scoring — needs training data we don't have yet
- Real biometric face matching — Hyperverge in Phase 2

---

## 18. Notification architecture

### 18.1 Channel routing (Phase 1 = email + in-app only)

Each notification has a `kind` and a `severity`. Routing matrix in `feature_flags`:

| Kind | In-app | Email | WhatsApp (Phase 2) | SMS (Phase 2) |
|---|---|---|---|---|
| OTP | — | primary | — | fallback |
| KYC status change | yes | yes | yes | — |
| New offer on your request | yes | yes | yes | — |
| EMI reminder 3d before | yes | yes | yes | — |
| EMI due today | yes | yes | yes | — |
| EMI overdue | yes | yes | yes | yes |
| Loan disbursed (UTR verified) | yes | yes | yes | — |
| Loan closed | yes | yes | yes | — |
| Dispute update | yes | yes | yes | — |
| Review received | yes | — | yes | — |
| Marketing | — | yes (opt-in) | yes (opt-in) | — |
| Default outreach | yes | yes | yes | yes |

### 18.2 Architecture

User-triggered or event-triggered → `NotificationOrchestrator` use-case → looks up user preferences + channel routing matrix → enqueues per-channel jobs in BullMQ → workers send via respective providers → `notifications` collection updated with delivery status per channel.

This means **`INotificationProvider` is actually a composite**. The composite reads the routing matrix, fans out to in-app + email + (Phase 2: WhatsApp + SMS) in parallel, and aggregates results. Adding WhatsApp in Phase 2 = registering a new provider in the composite + flipping a flag.

---

## 19. Realtime chat architecture

### 19.1 Threading model

- One thread per (loanRequest+offer) pair during negotiation
- That thread carries over to the loan when offer is accepted
- One thread per dispute (separate from loan thread, to keep evidence clean)
- No DMs outside loan/dispute context in Phase 1 (prevents off-platform money negotiation that bypasses agreement)

### 19.2 Storage

- `chat_threads` row per thread, with `participants[]`, `lastMessageAt`, `unreadCounts: { userId: count }`
- `messages` per individual message, with `threadId`, `senderId`, `body`, `attachments[]`, `at`, `readBy: [{userId, at}]`
- Attachments uploaded to Cloudinary via a signed-upload preset that restricts file types and size. URL stored as Cloudinary public ID, never the raw URL.

### 19.3 Realtime semantics

- Optimistic send on client (UI shows immediately with pending state)
- Server validates, persists, broadcasts to room
- Acknowledgement returns server-side ID + timestamp; client reconciles
- Typing indicators are ephemeral (not persisted), broadcast directly
- Read receipts persist on the message row
- Server enforces message rate limit (20 msg/min/user per thread)

### 19.4 Scale and offline

- Phase 1: single Socket.io process on Render. Capacity: ~5K concurrent connections. Vastly more than needed.
- Phase 2+: Redis adapter for Socket.io horizontal scaling. No code change.
- Offline: messages POST'd via REST when WS down. Reconnect replays missed messages via thread fetch.

### 19.5 Compliance

- All messages retained 3 years for regulatory and dispute audit
- "Off-platform" detection: simple regex for UPI ID / phone number patterns in messages → soft warning to user, logged for admin review
- Admin can read any thread under audit context (with audit log entry)

---

## 20. Agreement / contract system

### 20.1 Phase 1 click-wrap

- Server generates loan agreement PDF via PDFKit using a template under `templates/agreements/` (one template per loan-type, versioned)
- PDF includes: parties, principal, ROI, tenure, schedule, default consequences, dispute clause, jurisdiction (governing law = Indian Contract Act + IT Act §10A; jurisdiction = borrower's city)
- Both parties view the PDF in-app, scroll-locked acceptance button (only enables after scroll to bottom)
- On click, server records `agreements` row with: `pdfPublicId`, `borrowerAcceptance: { at, ip, deviceFingerprint, userAgent }`, `lenderAcceptance: {...}`, `hash: sha256(pdfBytes)`
- Hash of bytes prevents repudiation later

This is legally enforceable in India under IT Act §10A (legal recognition of electronic records) and §65B (admissibility). Not as strong as Aadhaar eSign, but defensible.

### 20.2 Phase 2 Aadhaar eSign via Digio

Drop-in replacement of the adapter. Same `IAgreementProvider` interface. Agreement gets a Digio eSign reference number alongside the click-wrap data. PDF gets the signed digital certificate appended.

### 20.3 Document retention

All agreements retained for 7 years (Contract Act + tax) in Cloudinary with restricted access. Downloads always go through a signed-URL endpoint that audit-logs the access.

---

## 21. Logging and audit trails

### 21.1 Three log streams

| Stream | Storage | Retention | Purpose |
|---|---|---|---|
| Application logs (Pino JSON) | Better Stack | 30 days | Debugging, error triage |
| Audit log (`audit_logs` collection) | MongoDB | 5 years | Compliance, dispute investigation, security |
| Access log (Render + Vercel native) | Provider native | 7 days | Traffic patterns, abuse detection |

### 21.2 Audit log schema (high level)

```typescript
{
  _id: ObjectId,
  at: Date,
  actorType: 'user' | 'admin' | 'system' | 'webhook',
  actorId: string,
  action: string,           // e.g., 'loan.offer.accepted'
  entityType: string,       // e.g., 'loan'
  entityId: string,
  before: object | null,
  after: object | null,
  ip: string,
  deviceFingerprint: string | null,
  userAgent: string | null,
  traceId: string,
  metadata: object,
}
```

Every Mongoose `pre`/`post` save hook on money-touching or identity-touching collections writes an audit-log entry. There is no business logic that bypasses this.

### 21.3 What is never logged

- Aadhaar full number, ever
- Bank account number (only last-4 in logs)
- OTPs (only hashes in cache)
- Passwords (always bcrypt hash; never plaintext)
- Cloudinary asset bytes (only IDs)

---

## 22. Lessons from existing Indian P2P platforms

Research summary of what's working and what isn't on Faircent, LenDenClub, i2iFunding, Lendbox, RupeeCircle, Finzy, Cashkumar — and how it informs TrustPe's design.

### 22.1 What competitors do well

- **All are RBI NBFC-P2P registered.** This is the table-stakes endpoint. We design Phase 3 to converge on this (either own license or partner).
- **Document verification is generally well-rated.** i2iFunding scores 93.9% positive on document verification per the 2025 NLP user-review study. We will not skimp on KYC — manual review in Phase 1, automated in Phase 2.
- **Withdrawals (settlement to lender) are well-rated.** LenDenClub 96.8%, Faircent 91.8%. Important signal: lenders care about getting their money out predictably. UTR-verified payments give us this from day 1.

### 22.2 What competitors do badly — and how we differ

- **Opaque scoring.** Faircent and others grade users (F1–F6 etc.) without showing why. Users complain about being stuck at low grades with no path forward. **TrustPe shows the full breakdown** (see §12.5) and explicitly tells the user "do X to lift your score."
- **Poor app UX.** i2iFunding scores 86.4% negative on app interface and 73% negative on application experience. **TrustPe is mobile-first PWA with modern UX from day 1.** Lighthouse a11y ≥ 95, Core Web Vitals targets enforced in CI.
- **Loan rejection without reason.** i2iFunding scores 88.3% negative on loan rejection experiences. **TrustPe doesn't reject loan requests** — they go to the marketplace and lenders choose. The borrower's score determines eligibility tier, not platform approval.
- **Customer service / login issues.** i2iFunding scores 59.3% negative on login. **TrustPe uses standard email-OTP + JWT with refresh rotation**, single sign-in pattern, no proprietary login flows.

### 22.3 What competitors do that we deliberately avoid

- **Pooled / fractional investment products** (LenDenClub's Hyperfix). RBI flagged these in 2024 as obscuring the 1-to-1 lender-borrower relationship that defines P2P. **TrustPe will never pool.** Every loan is exactly one lender to one borrower (or, in Phase 3 with consent, a borrower's request explicitly split across N pre-agreed lenders, with each loan as a separate record).
- **Promised returns to lenders.** Multiple platforms have hinted at "expected XX% ROI." RBI prohibits this. **TrustPe shows historical realized ROI ranges per borrower TrustScore band**, never a promise.
- **Auto-invest for new users.** Sounds convenient but abstracts away the trust-decision that is TrustPe's core differentiator. **No auto-invest until Phase 3+,** if ever.
- **Aggressive collections / harassment.** Has triggered RBI enforcement on multiple platforms. **TrustPe's recovery in Phase 1 is admin facilitation only** — calm outreach, payment-plan offers, no threats. Phase 3 introduces legal notices through proper templated channels, never aggressive tactics.
- **Cross-selling insurance.** RBI explicitly prohibits this on P2P platforms post-2024 update. **TrustPe will never cross-sell insurance**, even after license.

### 22.4 What's missing from the market

- **Trust progression that actually rewards new users.** Existing platforms either reject thin-file borrowers or push them to high ROI bands they can't repay. **TrustPe's progressive ladder (T0 → T4) is designed for users to grow into the system.**
- **Reputation as a public profile.** Existing platforms hide your loan history. **TrustPe makes verified loan history public** (with consent at signup) — creates real trust transferable to future loans.
- **Community signals.** No existing platform uses community vouching. **TrustPe adds this in Phase 2.**
- **Transparent factor breakdown.** Already covered — this is our biggest UX-level differentiator.

---

## 23. Third-party services — current and future

| Service | Phase | Purpose | Cost notes |
|---|---|---|---|
| MongoDB Atlas | Phase 1 | Database | Free M0 → ~$60/mo M10 at scale |
| Upstash Redis | Phase 1 | Cache/queue/RL | Free 10K commands/day → pay-as-you-go |
| Cloudinary | Phase 1 | KYC docs, agreement PDFs, chat attachments | Free 25 credits/mo |
| Resend | Phase 1 | Transactional email (incl. OTP) | Free 3K/mo |
| **Expo + EAS Build** | **Phase 1** | **RN Android app build, OTA updates, internal distribution** | **Free tier: ~30 builds/month + unlimited OTA. Plenty for solo dev.** |
| **Expo Push Service** | **Phase 1** | **Push notifications (FCM under the hood)** | **Free, unlimited at our volumes.** |
| **Expo SecureStore** | **Phase 1** | **Encrypted token storage on device (Android Keystore)** | **Free, part of Expo SDK.** |
| **Expo LocalAuthentication** | **Phase 1** | **Biometric (fingerprint/face) unlock** | **Free, part of Expo SDK.** |
| **`react-native-tesseract-ocr`** | **Phase 1** | **In-app OCR for UPI/payment screenshots (fallback when native Intent return is incomplete)** | **Free (MIT). Native bundle adds ~5MB to APK.** |
| **`react-native-upi-payment` (or custom Expo native module)** | **Phase 1** | **Fires UPI Intent via startActivityForResult; parses NPCI-standard return data** | **Free (MIT).** |
| Sentry | Phase 1 | Error tracking (RN + Express + admin Next.js) | Free 5K events/mo |
| Better Stack | Phase 1 | Log aggregation | Free 3 GB/mo |
| UptimeRobot | Phase 1 | Uptime monitoring | Free |
| FingerprintJS open-source | Phase 1 | Device fingerprinting (admin web only; RN uses native device identifiers via Expo) | Self-host free |
| GitHub Actions | Phase 1 | CI (typecheck, lint, unit tests, EAS build trigger) | Free 2000 min/mo |
| Vercel | Phase 1 | Admin panel hosting (only frontend on Vercel in Phase 1) | Free Hobby |
| Render | Phase 1 | Backend API hosting | Free (auto-sleeps) → $7/mo Starter |
| **iOS RN build (via EAS)** | **Phase 2** | **iOS App Store + TestFlight distribution** | **Apple Developer Program: $99/year** |
| **Google Play Console** | **Phase 2** | **Play Store release (closed testing → production)** | **$25 one-time** |
| **Play Integrity API** | **Phase 2** | **App attestation, anti-tampering** | **Free at our volumes** |
| **Public Next.js site (`apps/web`)** | **Phase 2** | **Marketing landing + SSR public profile pages for SEO** | **Vercel Hobby free tier** |
| Meta WhatsApp Cloud API | Phase 2 | OTP + notifications | Free 1K conversations/mo |
| MSG91 | Phase 2 | SMS (with DLT) | ₹0.15–0.25/SMS |
| DigiLocker (direct or via Setu) | Phase 2 | Aadhaar XML eKYC | Free direct (RRA registration); paid via Setu (~₹2/check) |
| **Cashfree Penny Drop (UPI)** | **Phase 2** | **Automated VPA-to-name verification at signup** | **~₹2/check, one-time per user** |
| **Cashfree UTR Recon** | **Phase 2** | **Automated UTR lookup per payment (replaces bilateral confirmation as primary)** | **~₹1/lookup** |
| Cashfree Payment Links | Phase 2 (optional) | Fallback payment collection | ~1.75% per txn |
| Cashfree Penny Drop on bank | Phase 2 | Bank account verification | ~₹2/check |
| Digio | Phase 2 | Aadhaar eSign | ₹15–25/doc |
| Setu | Phase 2 | Account Aggregator (via sponsored FIU) | Partnership cost + ₹2–5/data fetch |
| Hyperverge | Phase 2 | Selfie liveness + face match | ₹3–10/check |
| Doppler | Phase 2 | Secrets management | Free → $7/user/mo |
| CIBIL / Experian / CRIF | Phase 2 (optional) / Phase 3 (default) | Credit pull | ₹20–50/pull |
| NBFC-P2P partner or own license | Phase 3 | True escrow + regulator reporting | Revenue share or capital intensive |

---

## 24. Folder structure (overview)

Full repo layout in `FOLDER_STRUCTURE.md`. Top level here:

```
trustpe/
├── backend/                    # Express + TypeScript (MVC)
│   ├── src/
│   │   ├── config/             # env, database, redis
│   │   ├── models/             # Mongoose schemas (User, Profile, Loan, Payment, ...)
│   │   ├── controllers/        # request handlers (thin)
│   │   ├── routes/             # Express routers (one file per resource)
│   │   ├── services/           # business logic + external API integrations
│   │   ├── middleware/         # auth, validation, error, rate limit
│   │   ├── jobs/               # BullMQ workers (EMI cron, notify) — Sprint 3+
│   │   ├── socket/             # Socket.io chat + live loan state — Sprint 2+
│   │   ├── utils/              # logger, jwt, crypto
│   │   ├── types/              # backend-only TS types
│   │   └── server.ts           # entry point
│   └── tests/{unit,integration}/
├── mobile/                     # React Native Expo Android (Phase 1 user app)
│   ├── app/                    # Expo Router screens
│   ├── components/
│   ├── services/               # API client, UPI Intent, OCR, push, secure store
│   ├── hooks/
│   └── utils/
├── admin/                      # Next.js admin panel (founder-only in Phase 1)
│   └── src/app/                # App Router pages
├── shared/                     # Shared between backend + mobile + admin
│   ├── schemas/                # Zod schemas (the contract)
│   ├── types/                  # Pure TS types (Paise, ApiResponse, ...)
│   └── constants/              # Tier caps, score bands, ROI cap, etc.
├── infra/                      # Infrastructure-as-code (Render Blueprints, Vercel project config)
├── docs/                       # This document set
├── scripts/                    # Bootstrap, seed, migration scripts
├── .github/workflows/          # CI
├── .cursorrules                # LLM-assist guidance
├── CLAUDE.md                   # LLM-assist guidance (Claude-specific)
├── package.json                # Workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

Why monorepo from day 1: (a) sharing zod schemas between client and server is the single biggest source of fintech bugs avoided, (b) React Native port in Phase 2 is mechanical only if `packages/core` already exists, (c) admin and web app share auth, profile, and UI primitives.

---

## 25. Deployment architecture

### 25.1 Environments

| Env | Web | Admin | API | DB | Purpose |
|---|---|---|---|---|---|
| local | `localhost:3000` | `localhost:3001` | `localhost:4000` | local Mongo via Docker | Dev |
| preview | Vercel preview per PR | Vercel preview per PR | Render free preview | Mongo Atlas (dev cluster) | PR review |
| staging | `staging.trustpe.in` | `staging-admin.trustpe.in` | `staging-api.trustpe.in` | Mongo Atlas (staging) | Pre-prod tests |
| production | `app.trustpe.in` | `admin.trustpe.in` | `api.trustpe.in` | Mongo Atlas (prod) | Real users |

### 25.2 CI/CD

- Push to feature branch → GitHub Actions runs typecheck, lint, unit tests, build → Vercel preview deploys web+admin, Render preview deploys API.
- PR merge to `main` → auto-deploy to `staging` → run e2e tests on staging → if green, manual promote button to production.
- Production deploys are gated behind a manual approval step. No accidental prod pushes.

### 25.3 Secrets

Each environment has its own JWT signing secret, Mongo URI, Cloudinary keys, Cashfree keys, etc. Stored in Vercel + Render env vars in Phase 1, migrated to Doppler when team grows.

### 25.4 Migrations

- MongoDB: schema versions in a `_migrations` collection. Migration files in `apps/api/migrations/` with up + down. Runner is `migrate-mongo`.
- Data migrations are idempotent and re-runnable.

---

## 26. Scaling roadmap

### 26.1 Indicators triggering each scale-up step

| Trigger | Action |
|---|---|
| Render free tier sleep is hurting UX | Move API to Render Starter ($7/mo). Same code. |
| Mongo Atlas M0 storage > 80% | Move to M10 (~$60/mo). |
| Socket.io single-process CPU > 70% sustained | Split realtime into its own service. Add Redis adapter. |
| Workers backlog growing | Scale BullMQ worker processes horizontally. |
| API p95 latency > 500ms | Profile, add indexes, add Redis read-cache layer. |
| 100K MAU | Begin extracting hot modules (KYC, payments) into separate services. Adapter interfaces make this seam clean. |
| 1M MAU / NBFC-P2P live | Move to AWS (EKS, Mongo Atlas dedicated or DocumentDB, ElastiCache, SQS, CloudFront). |

### 26.2 What does *not* require scaling early

- Express is fine at 5K req/min on a single Render instance with proper indexes.
- Mongoose is fine at 100K writes/day.
- Socket.io single-process is fine to 5K concurrent.

---

## 27. Security checklist (Phase 1)

- All traffic HTTPS; HSTS preload submission once we have a stable domain
- JWT signing secret 256-bit, rotated quarterly
- Refresh tokens single-use rotating, theft-detection chain
- Argon2id for any password hashing (admin); bcrypt cost 12 minimum
- Helmet middleware on Express (CSP, X-Frame-Options, etc.)
- CSRF: SameSite=Lax on cookies, plus custom header check on state-changing endpoints
- CORS: explicit allowlist, never `*`
- Rate limit on every endpoint (Redis-backed)
- Zod validation on every input
- Mongo query parameterization (Mongoose handles this; no raw `$where`)
- File upload: type + size validation server-side, Cloudinary signed uploads only
- KYC images encrypted at rest in Cloudinary, accessed only via signed URLs through audit-logged endpoints
- No secrets in code, ever; `.env.example` only, real `.env` gitignored
- `npm audit` / `pnpm audit` in CI, fail on high+ severity
- Snyk free tier scan weekly
- Aadhaar last-4 only in any computed field; full Aadhaar only inside the encrypted image
- Audit log on every money/KYC/state change
- Admin 2FA mandatory
- Admin IP allowlist on production
- Penetration test before Phase 3 (use a CERT-In empaneled vendor — required for RBI license)

**RN Android app — Phase 1 specifics:**

- **APK signing**: production builds signed with a release keystore stored in EAS secrets (not in repo). Keystore lost = cannot push updates → backup the keystore offsite.
- **Network security config**: `android:usesCleartextTraffic="false"`. All API calls over HTTPS only.
- **Certificate pinning**: pin the Render API certificate (or its issuing CA) in the RN HTTP client. Prevents MITM even on compromised user devices. Update path: rotate via OTA when cert rotates.
- **Token storage**: refresh token only in Expo SecureStore (Android Keystore-backed). Never in AsyncStorage, never in plaintext files.
- **Biometric gate**: optional but encouraged for KYC-completed users. App start → biometric prompt → unlock SecureStore.
- **Screenshot protection (optional)**: `FLAG_SECURE` on KYC + payment screens prevents screenshots of sensitive data within TrustPe (still allows the user to capture their UPI app screens, since those aren't inside TrustPe).
- **Clipboard hygiene**: never write tokens or sensitive data to clipboard. Pasted UTR detection from clipboard is opt-in.
- **Deep-link allowlist**: app only handles `trustpe://` and our own HTTPS deep links. Reject malformed UPI return URIs.
- **Debug build segregation**: production APK strips all debug logs; Sentry source maps uploaded but symbolicated only in Sentry.
- **Root/jailbreak warning (Phase 2)**: warn user on rooted devices (does not block; just discloses risk).
- **Play Integrity attestation (Phase 2)**: backend verifies Play Integrity token on every sensitive call (payment initiation, KYC submit).

---

## 28. Compliance roadmap (toward Phase 3)

If the answer to the regulatory question becomes **partner with an NBFC-P2P**, the engineering work to enable it is roughly:

1. Wire the partner's escrow API behind the existing `IPaymentProvider` interface
2. Wire the partner's KYC norms (CKYC fetch) behind `IKycProvider`
3. Update agreement template to reference the partner NBFC
4. Update terms of service
5. Build reporting export for partner's regulatory team
6. Co-sign data-processing agreement

Estimated work: 4–8 weeks beyond Phase 2.

If the answer becomes **get our own NBFC-P2P license**, the work is:

1. Engineering: same escrow + reporting wiring, plus build the periodic regulatory report exporters (RBI Form L, monthly/quarterly returns)
2. Capital: ₹2 crore NOF demonstrated to RBI
3. Governance: board with fit-and-proper directors, principal officer, GRO, compliance officer (separate person)
4. Documentation: business plan, IT policy, IS policy, AML policy, FPC, board minutes
5. Application: RBI online application, in-principle approval, conditions compliance, final certificate
6. Audit: information-systems audit by CERT-In empaneled auditor

Estimated timeline: 6–12 months from application.

The architecture supports both. The platform code does not change based on which path you pick — only adapter implementations swap.

---

## 29. Open questions to revisit at Phase 2 kickoff

Captured here so we don't forget them:

1. Final NBFC-P2P regulatory path (partner vs own license)
2. CIBIL/Experian/CRIF — which bureau and at what tier do we pull
3. WhatsApp Business display name + Meta onboarding kickoff
4. DigiLocker direct vs via Setu — pick based on volume and engineering cost
5. AA partner (Setu / Finvu / OneMoney) — pick based on FIU sponsorship terms
6. Hindi + Bengali UI — when, which screens first (Phase 3+)
7. Public default registry — exact disclosure scope (handle + amount + date only, or more)
8. iOS app — included in Phase 2 RN scope or Android-first
9. Refer-and-earn mechanic — design before Phase 2
10. Should we ever support pooled lending under a regulatory wrapper that allows it (e.g., partner with a co-lending NBFC)? Default: no, but reconsider at scale.

---

## 30. Approval gate

This document is the source of truth for everything that ships in Phase 1. Before any code is generated, please confirm:

1. **Phase 1 scope (§3.1)**: React Native (Expo) Android user app + Next.js admin panel + Express backend, built in 8–12 weeks. 30–50 invited friends-and-family users. Direct APK distribution via Expo internal links (no Play Store yet). No public Next.js site in Phase 1.
2. **Phase 1 verification approach (§6.3)**: Native Android UPI Intent Result is the primary payment-confirmation path — UPI app returns `Status / txnRef / Amount / responseCode` directly to TrustPe; no screenshot needed on happy path. Screenshot + Tesseract OCR + per-app capture guides (§6.3.5) kept as fallback. Receiver attests with single tap. 24h retraction window. Manual UTR entry as last-resort fallback.
3. **Phase 2 entry criteria (§3.2)**: 30–40 completed loans, default rate <12%, repayment-on-time >75%, then iOS RN build, Play Store launch, Cashfree/DigiLocker/Digio/Setu/WhatsApp paid integrations, public Next.js site.
4. **TrustScore (§12)**: CIBIL-style 300–900 range, five named bands, transparent factor breakdown shown to users.
5. **Dispute SLAs (§16)**: 24h first response, 7 days resolution standard, 30 days complex. Founder is GRO in Phase 1.
6. **Permanent guardrails (§22.3)**: no pooling, no promised returns, no aggressive collections, no insurance cross-sell — forever.
7. **Phase 1 budget envelope**: ₹0/month operational + Apple/Google fees deferred to Phase 2. Only fixed cost is `trustpe.in` domain (~₹800/year). All Expo services (Push, EAS Build, SecureStore, LocalAuthentication, Updates) used within free-tier limits.
8. **Token + auth model (§10)**: RN access token in memory, refresh token in Expo SecureStore with biometric gate; admin web access in memory, refresh in httpOnly cookie. Theft-detection rotation chain. Admin 2FA mandatory.
9. **Security baseline (§27)**: certificate pinning, APK signing via EAS secrets, SecureStore-only token persistence, network security config (no cleartext), KYC images encrypted at rest in Cloudinary, no raw Aadhaar number ever stored.

Once approved, I'll proceed to write the four satellite documents in order:
- `SCHEMAS.md` — every MongoDB collection, every field, every index (including new `payment_intents`, `upi_registrations`, the OCR/Intent-return audit shape)
- `API_DESIGN.md` — every REST endpoint, every Socket.io event, every error envelope
- `ENGINES.md` — TrustScore engine pseudocode, EMI engine, loan-lifecycle state machine, eligibility ladder
- `FOLDER_STRUCTURE.md` — exact monorepo file layout + `CLAUDE.md` + `.cursorrules` + bootstrap commands for the new `apps/mobile/` Expo project

Then code generation starting with `packages/core` (the shared types, zod schemas, and port interfaces that everything else depends on).

Once approved, the next milestones are:

- `SCHEMAS.md` — every collection, every field, every index
- `API_DESIGN.md` — every endpoint, every request, every response
- `ENGINES.md` — pseudocode for TrustScore, EMI, lifecycle, eligibility
- `FOLDER_STRUCTURE.md` — exact file layout + `CLAUDE.md` + `.cursorrules` + bootstrap commands
- Then code generation, one module at a time, starting with `packages/core` (types + ports + zod schemas) because everything else depends on it.
