# TrustPe — Play Store Distribution Runbook

**Status:** Phase 1 distribution strategy
**Audience:** Bhagirath (you'll be doing this)
**Last updated:** 2026-06-07

> **Read this before you do anything in Play Console.** Choosing the wrong track on Day 1 is hard to walk back. See `REGULATIONS_AND_MONETIZATION.md` §10 for the regulatory reasoning behind these track recommendations.

---

## 1. The plan in one paragraph

For your friends-and-family closed pilot, use Play Console's **Internal testing** track. Up to 100 testers per app, invited by email. The app is **not publicly listed**, **not discoverable by search**, and **bypasses Google's strict India Personal Loan Apps policy review** that would otherwise demand RBI registration or NBFC partnership disclosure. Your friends install via a private opt-in URL. They tap the URL → opt in → install from Play Store as a regular app, with regular auto-updates, but the world never sees the app exists.

When you outgrow 100 testers, graduate to **Closed testing** (multiple groups of up to ~10,000 testers each, still private opt-in only). **Never** push to Production track until the NBFC partnership lands — Google will reject under the Personal Loan Apps policy, and even if it slips through, a public listing becomes an exhibit when RBI looks.

---

## 2. Pre-flight checklist

Before you touch Play Console:

- [ ] Decide on the legal entity that will own the app. For Phase 1, a sole-proprietor or your personal name is OK. For Phase 1.5+, register a private limited company and migrate the Play Console account.
- [ ] Pick a developer name. Use a generic personal-finance-adjacent name, NOT "TrustPe Lending" or "TrustPe P2P." Suggested: "TrustPe Network" or "Trustpe Labs."
- [ ] Buy a domain (you may already have `trustpe.in`). You'll need it for:
  - Privacy policy URL (required by Play Console)
  - Terms of service URL
  - Email contact (e.g. `support@trustpe.in`)
- [ ] Host a minimal privacy policy at `https://trustpe.in/privacy`. The policy must list every data category you collect — Aadhaar/PAN images, selfie video, phone, email, UPI ID, location, device identifiers. Google will reject without this. A no-code Notion / Carrd site is fine.
- [ ] Host a minimal terms of service at `https://trustpe.in/terms`. Specifically include the line *"TrustPe is a private personal-lending network for invited members. We do not move funds, do not act as a lender, and do not guarantee any loan or repayment."*
- [ ] App icon (512×512 PNG, transparent background) and feature graphic (1024×500 PNG).
- [ ] 2–8 phone screenshots (16:9 or 9:16, 1080×1920 ideal).
- [ ] Short description (≤80 chars) and full description (≤4000 chars). **Critical:** copy must NOT use "P2P," "lending platform," "investment," "earn returns," "fixed yield." Use "private personal-lending network for trusted communities," "track loans between friends," "transparent loan agreements."

---

## 3. Step-by-step: getting the app on Internal testing

### 3.1 Set up Play Console (one-time, ~30 min)

1. Go to [play.google.com/console](https://play.google.com/console) and pay the **$25 one-time** developer registration fee. You'll do identity verification (passport / Aadhaar acceptable; this takes 1–3 days).
2. Once verified, click **Create app**. Fill in:
   - App name: `TrustPe`
   - Default language: English (United States)
   - App or game: App
   - Free or paid: Free
   - Declarations: tick all required boxes
3. In the app's sidebar, complete the **App content** section: privacy policy URL, app access (logged-in users only with test credentials documented for Google reviewers), ads (none), content rating (use the questionnaire — TrustPe is "Everyone"), target audience (18+), news app (no), COVID-19 (no), data safety (declare every data category — see §4).
4. Set up **Store listing** with the assets from your pre-flight checklist.

### 3.2 Generate an Android upload key (one-time, ~10 min)

You need an upload key to sign builds. Easiest path is to let EAS Build manage it:

```bash
cd mobile
bunx eas build:configure
# When prompted: "Would you like to automatically create an EAS-managed keystore?" → Yes
```

EAS stores the keystore securely. You'll never have to think about it again. Don't try to manage Android keystores yourself for Phase 1 — it's a footgun.

If you want to verify the keystore exists later:
```bash
bunx eas credentials --platform android
```

### 3.3 Build a production AAB (~15 min the first time, ~5 min after)

Play Store wants **Android App Bundle (AAB)** format, not APK. Your `eas.json` already has a `production` profile that builds AAB:

```json
"production": {
  "channel": "production",
  "android": { "buildType": "app-bundle" }
}
```

Run the build:
```bash
cd mobile
bunx eas build --platform android --profile production
```

EAS builds in the cloud (~10–15 min). You'll get a download URL for the `.aab` file at the end. Download it.

> **Note on app.json version bumps.** Every Play Store upload needs a unique `versionCode` (integer) in `app.json`'s `android` section. Either bump it manually before each build, or set `"appVersionSource": "remote"` (already done in your eas.json) and let EAS auto-increment.

### 3.4 Create the Internal testing release (~10 min)

1. In Play Console, go to **Testing → Internal testing → Create new release**.
2. Upload the `.aab` file you just built.
3. Release name: auto-fills (e.g. "1 (0.1.0)"). Keep it.
4. Release notes: short, e.g. *"First pilot build — Aadhaar + PAN + selfie + UPI ID setup, basic borrow/lend flow."*
5. Click **Next → Save → Review release → Start rollout to Internal testing**.
6. Build is now in Google's hands. Internal track typically goes live within minutes to a few hours.

### 3.5 Invite your friends as testers (~5 min)

1. Stay on the **Internal testing** page.
2. Under **Testers**, click **Create email list** (or use a Google Group if you have one).
3. Add up to 100 email addresses — your friends' Gmail accounts. Save.
4. Tick the checkbox to allow these testers to access the app.
5. Above the tester list, there's an **Opt-in URL** like `https://play.google.com/apps/internaltest?id=in.trustpe.app`. Copy it.
6. WhatsApp / email this URL to your friends along with this short instruction:

   > *"Tap this link from your Android phone, opt in to be a tester, then it'll take you to Play Store where you can install TrustPe. You'll need to be signed in with the Gmail address I added you with — let me know if it's a different one. Updates happen automatically just like any other Play Store app."*

Done. They install. You ship updates by repeating §3.3–§3.4. They get the update automatically.

---

## 4. Data Safety form — the part that needs care

Google's Data Safety form is the place where lying gets apps banned. Be precise:

| Data category | Collected? | Shared with third parties? | Purpose | Optional? |
|---|---|---|---|---|
| Personal info — Name, email, phone | Yes | No | Account management, communication | No |
| Photos and videos — Aadhaar / PAN images, selfie video | Yes | No — stored on Cloudinary (your processor) | Account management (KYC verification) | No |
| Financial info — UPI ID, bank info | Yes | No | Account management | No |
| App activity — In-app actions | Yes | No | Analytics, App functionality | No |
| Device or other IDs — Device ID | Yes | No | Fraud prevention, Account management | No |
| Location | No | — | — | — |
| Contacts | No | — | — | — |

**Important declarations:**
- ✅ Data is encrypted in transit (TLS)
- ✅ Data is encrypted at rest (Cloudinary + MongoDB Atlas default encryption)
- ✅ Users can request data deletion (add an in-app or email-based deletion mechanism; you'll need this regardless)
- ❌ Do NOT claim "no data collected" or "no data shared" if Cloudinary processes your images — that's third-party processing even if you control it

Cloudinary, Resend, and MongoDB Atlas all count as data processors. Disclose them in your privacy policy.

---

## 5. Avoiding the Personal Loan Apps policy gate

Google introduced the **Personal Loan Apps in India** policy in 2022 (and tightened in 2023) after RBI's Digital Lending Guidelines. Apps that facilitate personal loans in India must either:

1. Be operated by a regulated entity (RBI-registered bank, NBFC, or NBFC-P2P), **or**
2. Be operated by a non-regulated entity with a clear declaration of partnership with a regulated lender, **or**
3. Be operated under specific exempt categories (employer lending, education institutions, etc.)

TrustPe in Phase 1 is none of these. **This is why we don't go to production.** Internal and Closed testing tracks bypass this policy enforcement — Google doesn't apply the financial-services review to non-public tracks.

**Triggers that escalate Google's scrutiny even on Internal/Closed:**

- Listing copy that says "lending," "loans," "investment," "credit"
- Screenshots showing rupee figures with a "₹X earned" framing
- A privacy policy that explicitly says "we facilitate loans between users"
- A high install count on Closed testing that catches a reviewer's eye

**Safer copy patterns:**

- ✅ "Track personal loans between friends"
- ✅ "Trust-based agreement records for private personal loans"
- ✅ "Document and manage loan agreements within your circle"
- ❌ "Borrow or lend money instantly"
- ❌ "Earn interest by lending"
- ❌ "P2P lending marketplace"

---

## 6. When to graduate from Internal to Closed testing

Internal track is capped at **100 testers per app**. When you hit ~70 active testers, plan to graduate:

1. In Play Console → **Testing → Closed testing → Create track**.
2. Same AAB upload flow, but you can create multiple tester groups (e.g. "Mumbai friends", "Bangalore friends", "Family") of up to ~10,000 each.
3. Opt-in URL works the same way — share privately, never publicly.

Closed testing track is also where you can run a more structured beta if you ever decide to test with a slightly broader group before the NBFC partnership.

---

## 7. When to NOT push to production

Recap of the §10 reasoning in `REGULATIONS_AND_MONETIZATION.md`:

- Google will likely reject the listing under the Personal Loan Apps policy.
- Even if it slips through, the public listing becomes a regulatory exhibit if RBI investigates the model.
- State moneylending exposure scales with public visibility.
- The friends-and-family thesis works at small scale precisely because it's not visible.

**The gating condition for production launch is:** TrustPe has a signed LSP (Lending Service Provider) agreement with a licensed NBFC, the NBFC is the lender of record on all new loans, and TrustPe's listing copy reflects "powered by [NBFC name]" disclosures per RBI's Digital Lending guidelines.

---

## 8. Update cadence and channel hygiene

Once on Internal testing:

- Patch releases (bug fixes): build → upload → testers auto-update within hours.
- Feature releases (sprint deliverables): build → upload → in-app banner notifies users to update. Easier than asking everyone to manually update.
- Major releases (Sprint completions): consider a brief "what's new" message via email/WhatsApp to your testers before the release rolls out.

EAS Update (separate from EAS Build) lets you push JavaScript-only updates over-the-air without rebuilding the AAB. For Phase 1 it's overkill, but worth knowing about for Phase 2 hotfixes.

---

## 9. Cost summary

| Item | One-time | Recurring |
|---|---|---|
| Google Play Console developer registration | $25 | — |
| Domain (trustpe.in or similar) | — | ₹600/year |
| Privacy policy / ToS hosting (Notion/Carrd free tier) | — | ₹0 |
| EAS Build (Expo) | — | Free for ~30 builds/month; paid plans $19/mo if you exceed |
| Compliance counsel on retainer (Phase 1.5+) | — | ₹25k–50k/month |
| **Phase 1 total to ship to friends** | **~₹2,500** | **~₹50/month** |

---

## 10. Quick FAQ

**Q: Can I just send my friends an APK file directly instead of using Play Store?**
A: Yes, EAS Build can produce an APK (your `preview` profile already does this — `bunx eas build --profile preview`). Friends sideload by tapping the APK and allowing "Install from unknown sources." Pros: simpler. Cons: no auto-updates, no Play Store crash reporting, friends have to trust your APK signature. Internal testing is genuinely easier for non-technical friends.

**Q: My friends are on iPhone. Does Internal testing work for them?**
A: That's TestFlight, not Play Console. Phase 1 is Android-only per the architecture. iOS comes in Phase 2.

**Q: Will Google see what's in my app on Internal testing?**
A: A reviewer technically can audit Internal track at any time, but routine compliance review happens only on Production. As long as your listing copy is conservative (per §5) and your data safety form is honest, you're fine.

**Q: What happens if I push to production by mistake?**
A: You can withdraw a release before it rolls out widely. If it's already live, you can take it down via Play Console. The risk is that "personal loan app" detection has already triggered and your developer account gets a strike. Two strikes and the account is suspended. **Don't risk it — stay on Internal/Closed until the NBFC partnership lands.**

**Q: Do I need a written agreement with my friends saying they're beta testers?**
A: Not legally required, but include a one-screen "Welcome to the closed pilot — by tapping Get Started you acknowledge this is a beta product, etc." inside the app. Lawyers will smile.

---

## 11. After this runbook

When you've done §3 once successfully:

1. Update `docs/sprint-status.md` with the Play Store internal track URL and number of testers.
2. Treat the Internal track as your "staging" environment forever. Build → upload → testers see it within hours.
3. Don't touch the Production track in Play Console until the NBFC partnership conversation in `REGULATIONS_AND_MONETIZATION.md` §9 starts paying off.
