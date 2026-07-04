# TrustPe — Play Store Listing Copy

**Purpose:** ready-to-paste copy for every Play Console form. Every line
here was chosen with `REGULATIONS_AND_MONETIZATION.md` §10 in mind — no
"P2P", no "loans", no "investment", no "earn returns", no "credit". The
positioning is **a trust-tracking app for people you already know**.

**Companion docs:**
- [`PLAY_STORE_DISTRIBUTION.md`](./PLAY_STORE_DISTRIBUTION.md) — strategy
  + why these copy choices
- [`PLAY_STORE_LAUNCH_CHECKLIST.md`](./PLAY_STORE_LAUNCH_CHECKLIST.md) —
  step-by-step launch runbook
- [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) and
  [`TERMS_AND_CONDITIONS.md`](./TERMS_AND_CONDITIONS.md) — what these
  forms reference

---

## App name + tagline

- **App name (50 chars):** `TrustPe — money agreements for your circle`
- **Short description (80 chars):**
  `Track personal money agreements with people you trust. Closed network, by invite.`

---

## Full description (4000 char limit)

```
TrustPe is a private, invite-only network for tracking personal money
agreements with people you already know — close friends, family, and
your wider trust circle.

If you've ever lent ₹2,000 to a cousin or borrowed ₹5,000 from a friend,
you know the awkward part: who said what, when it's due, was it really
paid back. TrustPe gives both sides a clean shared record so the money
part stays clear and the relationship stays warm.

WHAT TRUSTPE DOES

• Lets you publish a short personal request inside your circle, with the
  amount, tenure (1–6 months), purpose, and the rate you and the other
  person agreed to.
• Lets the other person review and accept the agreement with a clear
  click-wrap signature — no paperwork, no chasing.
• Tracks each repayment instalment and reminds both sides as due dates
  approach.
• Maintains a reputation score (TrustScore, 300–900) based only on how
  people in your circle review you after a settled agreement. It is
  never reported to any credit bureau and is visible only inside TrustPe.

WHAT TRUSTPE DOES NOT DO

• TrustPe is not a bank, NBFC, or licensed lender. It does not hold,
  pool, or move money. Every payment happens directly between the two
  people over their own UPI apps.
• TrustPe makes no promise of returns and no guarantee of repayment.
  The agreement is between you and the other person.
• TrustPe is not open to the public. The pilot is closed and invite-only.
  Public discovery, public listing, and open marketplaces are not part
  of this app.

HOW IT FITS YOUR LIFE

• Start by setting up a verified profile (one-time, ~3 minutes): a few
  ID images, a quick selfie video, your UPI VPA. Your full Aadhaar number
  is never stored — we only ever keep the card image, encrypted at rest.
• A small TrustPe team reviews each profile by hand to keep the network
  small and known. You'll hear back within 24 hours.
• Once verified, you can publish or accept agreements with anyone else in
  your invited circle.

PRIVACY YOU CAN AUDIT

• Aadhaar number is never stored — only the card image, encrypted at
  rest in Cloudinary, accessed only by the reviewer.
• Every change to a verified record is logged in an append-only audit
  trail, retained for 5 years.
• You can ask for an export or deletion of your account at any time;
  see Settings → Privacy.

WHO THIS IS FOR

People who already have a trusted circle (family, close friends, a
neighbourhood community, a hostel batch) and want a clean shared record
of the small agreements that happen between them anyway.

If you're looking for a public marketplace, a high-yield investment, or
a way to discover new lenders or borrowers — this is not that app.

CONTACT

privacy@trustpe.in for data-protection requests
support@trustpe.in for everything else
We reply within 24 hours.

TrustPe is a closed Phase 1 pilot. Membership is by invitation only.
```

Word count: 460 — well under the 4000 char limit, deliberately. Long
listings get skimmed and increase the surface for a reviewer to find
something to challenge. Keep this short.

---

## Release notes — first build

```
First pilot build for invited testers. Includes:
• Verified profile setup (PAN, Aadhaar card image, selfie, UPI VPA)
• Personal money-agreement publish and accept
• Click-wrap signing with audit hash
• Instalment tracking with due-date reminders
• In-app trust reputation (300–900) based on settled agreements
Pilot is closed and invite-only.
```

Word count: 50. Releases that say "first build" with no other content get
rejected for being lazy; the bullets prove there's a real app.

---

## Release notes — subsequent builds

Use this template. Pick the lines that apply, drop the rest.

```
• [bug] Fixed a crash when …
• [bug] Resolved a layout issue on …
• [improvement] Faster …
• [improvement] Clearer copy on …
• [new] Added …
Closed pilot. Invite-only.
```

---

## Tester invite — WhatsApp

Paste this into WhatsApp / iMessage when you invite a tester:

```
Hey [first name] — I've been building TrustPe, a small private app for
keeping track of money agreements between people who already trust each
other (your family, close friends, etc.). I'd love your help testing it
on the closed pilot.

Two things you'd need to do:

1. Tap this link from your Android phone:
   https://play.google.com/apps/internaltest?id=in.trustpe.app
2. Accept being a tester. Play Store will then offer you the install.

You'll be signed in with the Gmail address I added you with — let me
know if it's a different one and I'll add that.

Once you're in: profile setup takes ~3 minutes. I'll approve you
manually (closed pilot — only invited people get in). Then you can
publish or accept an agreement with anyone else I've invited.

If anything's confusing, just WhatsApp me and I'll fix it. Honest
feedback is what I want most. Thanks for trying it!
```

---

## App content — App access (required form)

Reviewers can't get past KYC. Be specific:

- Pick: "All or some functionality is restricted."
- Add an entry:
  - **Restricted functionality:** All flows beyond signup OTP
  - **Username / phone for test access:**
    `playreview+1@trustpe.in` / `+919999999990`
  - **Password / OTP path:** "OTP delivered to email above. The reviewer
    can also email support@trustpe.in for a fresh whitelisted account."
  - **Other access info:** "Closed friends-and-family pilot. Public
    signup is not enabled. Please use the test account above."

Mark this entry as required to access core functionality.

> Operational note: keep `playreview+1@trustpe.in` whitelisted with KYC
> auto-approved on the backend so reviewers can actually exercise the
> flow without waiting for manual review.

---

## App content — Data safety form

Copy these answers row-by-row into Play Console → App content → Data
safety. Every "Yes" must match `PRIVACY_POLICY.md` §3.

### Data collection + sharing

| Data type | Collected | Shared with 3rd parties | Required for app | Purposes |
|---|---|---|---|---|
| Name | Yes | No | Yes | Account management, Communications |
| Email | Yes | No | Yes | Account management, Communications |
| Phone number | Yes | No | Yes | Account management, Communications |
| User IDs (in-app) | Yes | No | Yes | Account management, Fraud prevention |
| Address — City | Yes | No | Yes | Account management (state moneylending cap) |
| Photos — KYC document images (Aadhaar card image, PAN card image) | Yes | No (stored on Cloudinary as our processor) | Yes | Account management — identity verification |
| Videos — selfie video | Yes | No (stored on Cloudinary as our processor) | Yes | Account management — identity verification |
| Financial info — Other financial info (UPI VPA only) | Yes | No | Yes | App functionality |
| App activity — App interactions | Yes | No | No | Analytics |
| Device or other IDs — Push notification token | Yes | No | No | App functionality (notifications) |
| Crash logs | Yes | No (once Sentry is wired in, "Yes — Sentry, our processor") | No | App functionality, Analytics |

Do NOT tick:
- Location (precise or approximate)
- Contacts
- Calendar
- SMS / call logs
- Browsing history
- Audio (the mic permission exists for selfie video, NOT for audio
  collection — declare under Videos only)
- Bank account number, payment card number, credit score, credit history
  (we don't collect any of these)

### Security practices

- ✅ Data is encrypted in transit (TLS 1.2+)
- ✅ You can request that data is deleted (Settings → Privacy + email)
- ✅ Committed to follow the Play Families Policy: N/A (not for under 13s)
- ✅ Independent security review: N/A in Phase 1 — plan to do before
  public launch

---

## App content — Financial features declaration

Play Console asks "Does your app offer financial features?" — answer
**Yes** and complete the supplementary form:

- **Personal loans:** Yes.
- **Are you a regulated entity?:** No.
- **Are you exempt?:** Yes — provide explanation:

```
TrustPe operates as a closed-membership network for tracking personal
money agreements between members who already know each other (the
"friends-and-family" pilot, currently fewer than 100 invited users).

TrustPe does NOT:
• Hold or move money on behalf of any user. Every payment occurs
  directly between the two members over their own UPI apps.
• Pool funds from any user.
• Act as a lender, broker, or intermediary on any specific transaction.
• Make any representation of returns, yield, liquidity, or guarantee.
• Solicit business from the general public; access is invite-only.

The app provides documentation, agreement signing, reminders, and a
reputation score (visible only inside the app, not reported to any
bureau) for the bilateral arrangements its members enter into. The legal
relationship of any agreement is solely between the two members.

For public launch under the RBI NBFC-P2P regime or via partnership with
a licensed entity we will submit a separate declaration; this submission
is for the closed-pilot Internal Testing track only.
```

---

## App content — Target audience

- Age groups: 18+ only.
- Appeals to children: No.

---

## App content — Content rating questionnaire

Answer "No" to everything sex / violence / drugs / gambling. The app
shows monetary values but it is not a gambling product (no probabilistic
outcomes). Result: **Everyone**.

---

## App content — Permissions form

The permissions in `app.json`:

- `CAMERA` — to capture KYC document images and selfie video.
- `READ_MEDIA_IMAGES` — to upload existing KYC photos from gallery.
- `USE_BIOMETRIC`, `USE_FINGERPRINT` — to unlock the app on devices
  where the user enables biometric lock.

If Play Console flags any sensitive permission, justify with the strings
already configured in `app.json` (e.g. `cameraPermission`).

We do NOT request: `SEND_SMS`, `READ_SMS`, `READ_CONTACTS`,
`READ_CALL_LOG`, `WRITE_EXTERNAL_STORAGE`, `ACCESS_FINE_LOCATION`,
`ACCESS_COARSE_LOCATION`, `SYSTEM_ALERT_WINDOW`. Confirm before each
build with `bunx expo prebuild --no-install --platform android` and
check the generated `AndroidManifest.xml`.

---

## Asset checklist

| Asset | Spec | Location to save | Status |
|---|---|---|---|
| App icon (foreground) | 432×432 PNG, transparent | `mobile/assets/icon.png` | (use existing if present) |
| App icon (adaptive background) | 432×432 PNG, solid colour | `mobile/assets/adaptive-icon.png` | |
| Play Store icon (high-res) | 512×512 PNG, opaque | `mobile/assets/store/icon-512.png` | TODO |
| Feature graphic | 1024×500 PNG | `mobile/assets/store/feature.png` | TODO |
| Phone screenshots (2–8) | 1080×1920 PNG | `mobile/assets/store/phone-N.png` | TODO |
| Splash screen | 1242×2436 PNG | `mobile/assets/splash.png` | (use existing if present) |

Suggested screenshots:
1. Home with TrustScore and "Verified" badge
2. KYC consent gate + DPDP-Act checkbox
3. Loan request published with state cap context
4. Agreement screen with click-wrap signature button
5. EMI schedule with status pills
6. Notification feed with a "EMI due tomorrow" item
7. Public profile of a counter-party with reviews

Avoid screenshots that show real names, real PAN numbers, real UPI
VPAs, or real amounts. Use fixture data.
