# TrustPe — User Onboarding Flow

**Status:** Active (Phase 1 — closed friends-and-family pilot)
**Last updated:** 2026-06-06
**Owners:** Bhagirath

This document is the single source of truth for what a user goes through from "tapping the install link" to "able to lend or borrow." It also documents the admin side of the same flow.

If the code disagrees with this doc, the doc is right and the code needs a fix (or this doc needs an update — flag it).

---

## 1. The shape, at a glance

Phase 1 is **a single onboarding funnel with one admin gate**:

```
Sign up (email + phone + name)
  → Email OTP
  → Profile setup (city, occupation, income)
  → KYC submission (4 captures + PAN + UPI ID, in one step)
  → Admin review (KYC + UPI verification in one pass)
  → Active — ready to lend/borrow
```

There is **no separate UPI registration step**. The UPI ID (VPA) is bound inside the KYC submission, and the admin verifies it during the same KYC review using a free NPCI name-lookup in their own UPI app.

There is **no bank account collection** anywhere in onboarding. Money never flows through TrustPe; lender disburses directly to borrower's VPA via UPI Intent. Bank account is not required for the loan agreement (identity + VPA + IP/device hash is enough for IT Act §10A enforceability).

---

## 2. Step-by-step (user side)

### 2.1 Sign up

- Screen: `mobile/app/(auth)/signup.tsx`
- Inputs: name, email, 10-digit Indian mobile number
- POST `/v1/auth/signup` → backend creates the user with `status='unverified'`, sends OTP via Resend
- User lands on the OTP screen

### 2.2 Verify OTP

- Screen: `mobile/app/(auth)/verify-otp.tsx`
- 6-digit code from email
- POST `/v1/auth/verify-otp` → returns `{ accessToken, refreshToken, user }`
- Backend transitions `status: unverified → onboarding`
- Mobile persists refresh token to SecureStore; routes to home

### 2.3 Profile setup

- Screen: `mobile/app/(onboarding)/profile.tsx`
- Inputs: city (autocomplete + PIN-code fallback), occupation category, optional role/company, monthly income band
- PATCH `/v1/me/profile` → marks profile complete
- Routes back to home

### 2.4 KYC submission (single step — identity AND payment)

- Screen: `mobile/app/(onboarding)/kyc.tsx`
- Wizard steps:
  1. Aadhaar front photo
  2. Aadhaar back photo
  3. PAN front photo
  4. 5-second selfie video (custom `SelfieRecorder` enforces duration via `expo-camera`'s `recordAsync({ maxDuration: 5 })`)
  5. Review: type PAN + UPI ID, submit
- POST `/v1/me/kyc` with Cloudinary public IDs + PAN + VPA
- Backend transitions `status: onboarding → pending_review`, `kycStatus: not_started → submitted`
- Home screen now shows "Awaiting review" card; auto-polls `/me` every 15s

### 2.5 Wait for admin review

- The mobile home screen polls `/me` every 15 seconds while `status='pending_review'`
- Also refetches when the app returns from background (AppState 'active')
- On approval: one-shot Alert *"KYC approved 🎉 — your UPI ID is verified and ready to use"*; home flips to "You're all set"
- On rejection: status moves to `suspended`; home shows suspended notice
- On clarification request: status moves back to `onboarding` with `kycStatus='needs_clarification'`; home shows a re-submit CTA pointing at the same KYC wizard

### 2.6 Active

- Once `status='active'`, the user can use lending/borrowing features (Sprint 2+)
- TrustScore bumps from 300 (Building) to 550 (Fair) on first KYC approval

---

## 3. What we collect and why

| Field | Where | Why we need it |
|---|---|---|
| Name | Sign up | Identity, loan agreement |
| Email | Sign up | OTP delivery, support |
| Phone (10-digit IN) | Sign up | Identity, future SMS in Phase 2 |
| City + occupation + income band | Profile | TrustScore inputs, lender browsing filters |
| Aadhaar front image | KYC | Identity verification (admin reads image, verifies on UIDAI portal) |
| Aadhaar back image | KYC | Address proof |
| PAN image | KYC | Identity verification |
| PAN number (10-char) | KYC | Required on every loan agreement (income tax compliance) |
| Selfie video (5s) | KYC | Liveness check, face-match against Aadhaar/PAN photo |
| UPI ID (VPA) | KYC | Disbursement (Sprint 3), EMI payments (Sprint 3) |

### What we deliberately do NOT collect

| Field | Why not |
|---|---|
| Aadhaar number (full or last-4) | Aadhaar Act §29 forbids non-KUA entities from storing it. Full number is visible on the image; admin verifies via UIDAI portal. |
| Bank account number + IFSC | Money never moves through TrustPe; UPI Intent is VPA-based (not bank-based); loan agreement is enforceable without bank details. |
| Government ID other than Aadhaar/PAN | Phase 1 scope; reconsider if expanding beyond friends-and-family. |
| Income proof documents | Self-declared income band is enough for Phase 1. |

---

## 4. Admin side

### 4.1 KYC review queue

- Page: `admin/src/app/(dashboard)/kyc/page.tsx`
- Lists all KYC records by status tab (Pending / Needs info / Approved / Rejected)
- Default tab is Pending, oldest first (longest-waiting reviewed first)

### 4.2 KYC detail page — single-pass review

- Page: `admin/src/app/(dashboard)/kyc/[id]/page.tsx`
- Layout, top to bottom:
  1. **Documents grid:** Aadhaar front, Aadhaar back, PAN, selfie video — all loaded directly from Cloudinary via the configured `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
  2. **Submitted details:** PAN number, UPI ID (monospace), timestamps
  3. **UPI verify card:** green panel with the user's VPA + Copy button + instructions to paste into your own UPI app for the free NPCI name-lookup
  4. **UIDAI verify card:** blue panel with link to `myaadhaar.uidai.gov.in/verify-aadhaar` for manual Aadhaar verification against the image
  5. **User context:** account status, KYC status, TrustScore
  6. **Decision panel:** Approve / Request clarification / Reject + required reason field
- POST `/v1/admin/kyc/:id/decision` with `{ decision, reason }`

### 4.3 The free NPCI name-lookup (UPI verification)

This is the heart of Phase 1 UPI verification — and it's free.

**Steps:**
1. Copy the VPA from the green "Verify UPI ID" card on the detail page (or click the Copy button)
2. Open any UPI app on your phone (GPay / PhonePe / Paytm / BHIM)
3. Tap "New Payment" / "Send to UPI ID"
4. Paste the VPA
5. The UPI app calls NPCI and shows the registered holder name on screen
6. Compare that name with the applicant's KYC name (shown right above the VPA card)
7. Cancel the transfer (do not send money)
8. Back in the admin panel: Approve if name matches, Request clarification if it doesn't, Reject if VPA is invalid

**Time per user:** ~20 seconds.
**Cost per user:** ₹0.
**Reliability:** very high — NPCI is the source of truth for VPA→name resolution.

### 4.4 The free UIDAI Aadhaar verification

Same idea, different system:
1. Read the 12-digit Aadhaar number from the uploaded Aadhaar front image (visible on the document)
2. Click the "Open UIDAI portal" button — opens `myaadhaar.uidai.gov.in/verify-aadhaar` in a new tab
3. Type the number, complete UIDAI's OTP step
4. UIDAI returns: valid + last-4 of mobile + age band + state + gender
5. Cross-check against the user's profile

### 4.5 Decision outcomes

| Admin click | KYC record status | User status | User kycStatus | TrustScore | UPI |
|---|---|---|---|---|---|
| Approve | approved | active | approved | 300 → 550 | implicitly verified (during this same review) |
| Reject | rejected | suspended | rejected | unchanged | n/a |
| Request clarification | needs_clarification | onboarding | needs_clarification | unchanged | n/a |

All transitions write `audit_logs` entries via `writeAudit()` and run in a Mongo transaction so KYC and User state never diverge.

---

## 5. Data model summary

### `User` collection

- `phone`, `email`, `name`, `handle`
- `status`: `unverified | onboarding | pending_review | active | suspended`
- `kycStatus`: `not_started | submitted | approved | rejected | needs_clarification`
- `roles[]`: `user | super_admin | admin | support | compliance | finance`
- `trustScore` (300–900) + `trustBand` (`building | fair | good | very_good | excellent`)

There is no `upiStatus` field — UPI is verified inside KYC, so `kycStatus='approved'` ⇒ VPA verified.

### `KycRecord` collection

- `userId` (unique, ref to User)
- `pan`
- `aadhaarFrontCloudinaryId`, `aadhaarBackCloudinaryId`, `panFrontCloudinaryId`, `selfieVideoCloudinaryId`
- `vpa` (the user's UPI ID)
- `vpaVerificationMethod`: `ocr_screenshot_auto | admin_manual | reverse_penny_drop | cashfree_penny_drop` — Phase 1 default is `admin_manual`
- `status`: `submitted | approved | rejected | needs_clarification`
- `submittedAt`, `reviewedAt`, `reviewedBy`, `reviewerNotes`

### `Profile` collection

- City, occupation, income band, etc. — separate from User to keep the auth-hot collection small.

---

## 6. Phase 2 swap points

These are the explicit places where Phase 1 trades off cost for manual labour, and what swap is queued for Phase 2 when audience grows beyond friends-and-family.

| Phase 1 (now) | Phase 2 (later) | Trigger to swap |
|---|---|---|
| Admin reads Aadhaar number from image, verifies on UIDAI portal | DigiLocker integration — signed XML returned by UIDAI | Audience expansion past ~200 users |
| Admin uses free NPCI name-lookup for UPI | Cashfree penny-drop API behind existing `IPaymentVerificationProvider` adapter (~₹2/user one-time) | Audience expansion OR admin labour > 5 min/day |
| `vpaVerificationMethod: 'admin_manual'` recorded on every KYC | `cashfree_penny_drop` swap; same schema, same enum value already defined | Same as above |
| Email-only OTP via Resend | Add SMS via MSG91 / Gupshup | When email deliverability hurts conversion |

The architecture's adapter pattern is what makes all of these single-file swaps. See `docs/ARCHITECTURE.md` §6.

---

## 7. Things to know if you're editing this flow

- The `kycSubmissionSchema` in `shared/schemas/kyc.ts` is the contract. Backend parses, mobile validates against it, admin reads the resulting record. Any field change starts here.
- Mongo schema changes in `backend/src/models/KycRecord.ts` need a thought about existing records — for Phase 1 pre-launch the dev DB can be wiped, but once we have real users we need a migration.
- The audit log discipline (CLAUDE.md "Audit logging — never bypass") applies — every state change in KYC writes an entry. Don't skip.
- The UPI verification doesn't have a "verified" boolean on the record; if you need to query "is this user's UPI verified" later, use `kycStatus === 'approved'`.

---

## 8. Why we redesigned away from a separate UPI registration

Earlier iterations had a standalone UPI registration step: user submits VPA + UPI app screenshot, admin reviews in a separate queue. We dropped it for three reasons:

1. **Two queues, one workflow.** Admin was already reviewing KYC for each user; UPI was always reviewed at the same time anyway. Merging avoided context-switching.
2. **Better verification path discovered.** Free NPCI name-lookup is more reliable than reading a screenshot for the VPA — NPCI is authoritative, the screenshot could be tampered or blurry.
3. **Less code for the same outcome.** Two collections, two services, two admin pages and a separate mobile screen got collapsed into the existing KYC flow.

The architecture's adapter pattern (`IPaymentVerificationProvider`) was unchanged by this refactor — only the *position* of the verification step in the funnel moved.
