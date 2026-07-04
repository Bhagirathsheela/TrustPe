# TrustPe — Play Store Launch Checklist

**Status:** ready-to-execute pre-flight + launch-day checklist for the
first Internal Testing release.
**Audience:** Bhagirath (you).
**Companion docs:**
- [`PLAY_STORE_DISTRIBUTION.md`](./PLAY_STORE_DISTRIBUTION.md) — the why
  behind every choice on this page
- [`PLAY_STORE_LISTING.md`](./PLAY_STORE_LISTING.md) — copy + data safety
  answers ready to paste

This file is the "do these things, in order, and you'll have a build in
Internal Testing" runbook. Tick the boxes as you go.

---

## Phase A — One-time setup (do once, ever)

### A1. Google Play Developer Account
- [ ] Pay the $25 developer registration fee at [play.google.com/console](https://play.google.com/console).
- [ ] Complete identity verification (passport / Aadhaar). Takes 1–3 days
      to clear.
- [ ] Set developer display name to **TrustPe Network** (not "TrustPe
      Lending" or anything with "P2P" / "loan" / "credit" in the name).
- [ ] Add `support@trustpe.in` as the developer contact email.

### A2. Hosting for legal pages
- [ ] Stand up a one-page site at `https://trustpe.in/privacy` rendering
      `docs/PRIVACY_POLICY.md`. Notion + custom domain works; Carrd
      works; a 30-line HTML file on Cloudflare Pages works. Anywhere that
      gives a real public URL.
- [ ] Same for `https://trustpe.in/terms`.
- [ ] Both must be reachable without login, no paywall, no robots-block.

### A3. EAS keystore
- [ ] In `mobile/`, run `bunx eas build:configure` and let EAS create + manage
      the keystore. Do not generate one yourself.
- [ ] Verify with `bunx eas credentials --platform android`.

### A4. App assets (create these in any tool you like)
- [ ] App icon — 512×512 PNG, opaque background, no transparency, no text
      smaller than ~64 px. The shield-with-checkmark concept from the
      admin login works.
- [ ] Feature graphic — 1024×500 PNG. Don't include your store rating, app
      icon, or device frames — Google rejects.
- [ ] 2–8 phone screenshots — 1080×1920 PNG. Capture: KYC flow start,
      home with TrustScore, loan request, agreement screen, EMI screen.
- [ ] Store them in `mobile/assets/store/` so they're easy to find later.

---

## Phase B — Pre-build (every build)

### B1. Bump version + versionCode
EAS auto-increments `versionCode` because `appVersionSource: remote` is
set in `eas.json` — confirm that's still true. Bump human `version` in
`app.json` for user-visible releases.

- [ ] `mobile/app.json` `version` reflects the planned release (e.g. `0.2.0`).
- [ ] You don't need to touch `versionCode` — EAS handles it.

### B2. Environment + secrets
- [ ] `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env.production` points to the
      production backend (Render).
- [ ] Production backend is up and reachable (smoke test with
      `curl https://api.trustpe.in/health`).
- [ ] Backend has the real `SENTRY_DSN`, `RESEND_API_KEY`,
      `CLOUDINARY_*`, `JWT_*`, `MONGODB_URI` set on Render.

### B3. Spot-check the build inputs
- [ ] `bunx tsc -p mobile/tsconfig.json --noEmit` is green.
- [ ] `bun --filter trustpe-backend test` is green.
- [ ] `bun --filter trustpe-shared build` succeeds.
- [ ] You've manually exercised the happy path once on Expo Go:
      signup → KYC → loan request → fund as another user → sign
      agreement → disburse → mark EMI → confirm receipt.

### B4. Privacy / Terms snapshot
The Play Console form asks for the exact URLs. The store listing must
also link to them.

- [ ] `https://trustpe.in/privacy` returns the latest copy of
      `docs/PRIVACY_POLICY.md`.
- [ ] `https://trustpe.in/terms` returns the latest copy of
      `docs/TERMS_AND_CONDITIONS.md`.

---

## Phase C — Build (every release)

### C1. Build the AAB
```bash
cd mobile
bunx eas build --platform android --profile production
```

- [ ] Build URL emitted at the end. Download the `.aab`.
- [ ] Confirm the build's `versionCode` is one higher than the previous
      one you uploaded to Play (look in Play Console → Internal testing
      → previous release).

### C2. (Optional) Smoke-install on a real device first
EAS produces an internal-distributable artifact too — use it to install
on your own phone before pushing to Play.

- [ ] Open the build URL on the device.
- [ ] Confirm app launches, login works, push notifications register.

---

## Phase D — Upload + release to Internal Testing

### D1. Create the release
- [ ] In Play Console → app → Testing → Internal testing →
      **Create new release**.
- [ ] Upload the `.aab`.
- [ ] Release notes (≤500 chars). Use the template in
      `PLAY_STORE_LISTING.md` section "Release notes — first build".
- [ ] **Save** → **Review release** → **Start rollout to Internal testing**.

### D2. First-build only — fill out App content
Play Console blocks rollout until every App content row is green. Use the
specific answers in `PLAY_STORE_LISTING.md`:
- [ ] Privacy policy → URL.
- [ ] App access → "All functionality is available without restrictions"
      is **wrong** — pick "All or some functionality in my app is
      restricted" and provide:
  - Test login email, phone, OTP path (or whitelisted test account)
  - Note: "Closed pilot. Reviewers — request a tester invite via
    support@trustpe.in."
- [ ] Ads → No.
- [ ] Content rating → fill questionnaire (Everyone).
- [ ] Target audience → 18+.
- [ ] News app → No.
- [ ] COVID-19 contact tracing → No.
- [ ] Data safety → copy answers from `PLAY_STORE_LISTING.md`.
- [ ] Government apps → No.
- [ ] Financial features → **Yes** → tick "Personal loans" → answer
      "I'm exempt because…" with the closed-circle wording in
      `PLAY_STORE_LISTING.md` (note: Internal testing track does not
      enforce this gate hard, but lying here is a banning offence later).
- [ ] Health → No.

### D3. Store listing (first build only)
- [ ] Short description (80 chars) — paste from listing doc.
- [ ] Full description (4000 chars) — paste from listing doc.
- [ ] App icon, feature graphic, screenshots — upload from
      `mobile/assets/store/`.
- [ ] Application category → **Finance**.
- [ ] Tags → Personal finance, Budgeting (NOT "lending", "credit").

---

## Phase E — Invite testers

### E1. Build the tester list
- [ ] Stay on Internal testing → Testers.
- [ ] **Create email list** → name it "TrustPe pilot — round 1".
- [ ] Paste 5 Gmail addresses (your first invitees).
- [ ] Tick the list so it's used for this release.

### E2. Share the opt-in link
- [ ] Copy the Internal testing opt-in URL
      (`https://play.google.com/apps/internaltest?id=in.trustpe.app`).
- [ ] Send each invitee the WhatsApp template in
      `PLAY_STORE_LISTING.md` section "Tester invite — WhatsApp".

### E3. Verify the loop
- [ ] One invitee accepts and installs (it takes 5–30 min for Play to
      propagate the opt-in).
- [ ] They sign up + complete KYC.
- [ ] You approve KYC from the admin panel.
- [ ] They receive the approval push + email.

---

## Phase F — Post-launch monitoring (first 72 hours)

- [ ] Render logs: tail with `render logs --service=trustpe-api -f`. Look
      for any `error` level events from the tracker.
- [ ] MongoDB Atlas: check Performance Advisor for missing indexes.
- [ ] Cloudinary: confirm KYC uploads are landing in the correct folder
      and being deleted after 30 days for closed accounts.
- [ ] Audit log: spot-check that every state change has an entry.
- [ ] Daily check-in WhatsApp to invitees: "Anything stuck?"

---

## Phase G — Common Play Console gotchas

These have all bitten people. Fix preemptively.

- **Rejection: "your app does not function as described."** Cause: the
  reviewer can't get past your login. Fix: in App content → App access,
  give them a working test account email and OTP path, *not* a phone
  number that needs a real SIM.
- **Rejection: "your app contains undisclosed sensitive permissions."**
  Cause: a transitive dependency adds a permission you didn't declare.
  Fix: run `bunx eas build --profile production --platform android` with
  `--verbose`, find the merged AndroidManifest, list every permission in
  the Play Console permissions form.
- **Rejection: "ineligible for the Personal Loans policy."** Cause: your
  listing copy contained "loans" / "credit" / "interest rate". Fix: use
  the listing copy in `PLAY_STORE_LISTING.md` — it has been laundered
  through the closed-circle messaging in
  `REGULATIONS_AND_MONETIZATION.md` §10.
- **Internal testers don't see the app.** Cause: invitee is signed in to
  Play with a different Google account than the one you whitelisted.
  Fix: ask them which email they actually use on Play and re-add.
- **Push notifications work in dev but not in prod.** Cause: missing
  `extra.eas.projectId` in `app.json`. Fix: confirm
  `Constants.expoConfig?.extra?.eas?.projectId` is non-empty at runtime;
  if not, run `bunx eas init` to bind the project.

---

## Quick reference — paths

- Mobile project: `mobile/`
- App manifest: `mobile/app.json`
- EAS build profiles: `mobile/eas.json`
- Store assets (when created): `mobile/assets/store/`
- Policy text: `docs/PRIVACY_POLICY.md`, `docs/TERMS_AND_CONDITIONS.md`
- Listing copy: `docs/PLAY_STORE_LISTING.md`
- Distribution strategy + reasoning: `docs/PLAY_STORE_DISTRIBUTION.md`
