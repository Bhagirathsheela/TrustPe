# TrustPe — Production Email Setup

**Status:** ready-to-execute runbook for turning on real transactional
email (OTP signup / login + KYC decisions).
**Audience:** Bhagirath (you).
**Companion docs:**
- [`PLAY_STORE_LAUNCH_CHECKLIST.md`](./PLAY_STORE_LAUNCH_CHECKLIST.md) — the
  broader launch plan; you'll come back here from Phase A.
- [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md) — lists Resend as a
  sub-processor.

At the end of this runbook, when a user hits **Sign up** or **Log in**
on the app, a branded TrustPe email lands in their inbox within seconds.
Until you do this, OTPs only appear in the backend logs.

---

## Concepts in 30 seconds

- **Transactional email provider:** Resend (chosen for zero setup, free
  tier of 3,000 sends/month, and a proper Node SDK). Sub-processor
  disclosed in the Privacy Policy.
- **From address:** must be at a domain you own AND have proved to
  Resend that you own via DNS records. The env var is `EMAIL_FROM`,
  default `TrustPe <no-reply@trustpe.in>`. If your DNS proof isn't set
  up, Resend rejects every send with a 4xx and no retry helps.
- **Reply-To:** where "reply" from a user goes. `EMAIL_REPLY_TO`,
  default `support@trustpe.in`. This doesn't need DNS proof — just a
  mailbox you actually read.

---

## Phase A — Sign up for Resend

1. Go to [resend.com](https://resend.com) → **Sign up** with your work
   email. Free tier gives 3,000 sends/month and 100 sends/day — enough
   for the entire closed pilot.
2. Confirm the sign-up link.
3. In the dashboard, go to **API Keys → Create API Key**.
   - Name: `trustpe-production`
   - Permission: **Full access** (Sending permission alone works too;
     full access is easier for pilot debugging).
   - Copy the key — starts with `re_...`. You won't see it again.

Store the key somewhere you'll find it in ~10 minutes when you set
Render env vars.

---

## Phase B — Prove you own `trustpe.in` (DNS setup, ~15 min + wait)

Resend requires SPF + DKIM records so mailbox providers (Gmail, Outlook,
Zoho, Rediff) don't drop your mail as spoofing.

1. In Resend, go to **Domains → Add Domain** → enter `trustpe.in`.
2. Resend shows a list of DNS records to add. For a typical setup you'll
   get roughly:
   ```
   MX      send                  10 feedback-smtp.us-east-1.amazonses.com
   TXT     send                  "v=spf1 include:amazonses.com ~all"
   TXT     resend._domainkey     p=MIGfMA0GCSqGSIb3DQEB... (long base64 blob)
   TXT     _dmarc                v=DMARC1; p=none; rua=mailto:dmarc@trustpe.in
   ```
   These change occasionally — copy from Resend's UI, not from here.
3. Log into wherever you host DNS for `trustpe.in` (Cloudflare, Route53,
   your registrar's control panel) and add each record. `_domainkey` and
   `_dmarc` are the ones people miss.
4. Back in Resend, click **Verify DNS records**. If they show green, go
   to step 5. If yellow, wait — DNS propagates in anywhere from 10 min
   to 24 hours. If red after 1 hour, double-check no typos on the DKIM
   value (the long TXT record is the usual culprit).
5. Once verified, the sender `no-reply@trustpe.in` (or anything else
   `@trustpe.in`) is authorised to send.

> **Rushed alternative:** while `trustpe.in` is being verified, you can
> temporarily send from `onboarding@resend.dev`. Set
> `EMAIL_FROM="TrustPe <onboarding@resend.dev>"`. Not for launch — Gmail
> may still flag it — but useful to smoke-test the code path.

---

## Phase C — Set Render env vars (~5 min)

In Render → your `trustpe-api` service → **Environment**:

Add these two:
```
RESEND_API_KEY=re_...              # from Phase A
EMAIL_FROM=TrustPe <no-reply@trustpe.in>
EMAIL_REPLY_TO=support@trustpe.in
```

Save. Render auto-restarts the service.

If your production backend is running elsewhere (e.g., a VPS or Fly), set
the same variables in that environment's secret store.

---

## Phase D — Verify with the readiness probe (~1 min)

```bash
curl https://api.trustpe.in/health/ready | jq
```

Expected response includes:
```json
{
  "ok": true,
  "env": "production",
  "dependencies": {
    "database": { "ok": true, "state": "connected" },
    "email":    { "ok": true, "live": true, "from": "TrustPe <no-reply@trustpe.in>" },
    "jwt":      { "ok": true },
    "cloudinary": { "ok": true }
  }
}
```

If `email.live` is `false` in production, RESEND_API_KEY is missing.
If `email.ok` is `false` in production, the readiness probe fails and
Render marks the service unhealthy — check the env vars.

---

## Phase E — Send yourself an OTP (~1 min)

The single best real-world test:

1. On the mobile app pointing at production, tap **Sign up**.
2. Enter your own name, phone, and a Gmail address you can check.
3. Hit **Send code**.
4. Check that Gmail inbox. You should see:
   - **From:** `TrustPe <no-reply@trustpe.in>`
   - **Subject:** `Confirm your TrustPe signup`
   - The branded TrustPe email with a 6-digit code.

Also `curl https://api.trustpe.in/health/ready` — nothing changed, but
double-check `email.live: true`.

If the email doesn't arrive within 30 seconds:
- Backend logs (`render logs --service=trustpe-api -f`) — look for
  `[email] sent` (good) vs `[email] failed` (bad, with a reason).
- Resend dashboard → **Logs** — every attempted send is here with the
  response. Common failures:
  - "Invalid from address": DNS not verified yet.
  - "Rate limit exceeded": free tier daily cap hit (100/day).
  - "Invalid recipient": bad email — validate at signup.

---

## Phase F — Recipient reputation warmup

For the first ~50 sends after DNS verification, Gmail may still route to
Spam. This is standard mailbox-provider throttling for new senders and
sorts itself out within a week.

Actions during the first week:
1. Ask your first few testers to explicitly mark the email as "Not spam"
   if they find it there.
2. Do not send bulk marketing content from this domain — you'll poison
   the reputation you're trying to build.
3. If you're seeing >5% spam classification in Resend's dashboard after
   a week, buy a paid Resend plan for the dedicated IP feature, and add
   a stricter DMARC policy (`p=quarantine` → `p=reject`) once you're
   confident.

---

## Phase G — Ops runbook

**Rotate the Resend API key** (quarterly, or immediately if you suspect
compromise):
1. Resend → **API Keys → Create** a new one → name it
   `trustpe-production-2`.
2. Render → update `RESEND_API_KEY` to the new value → save (service
   restarts).
3. Verify with `curl /health/ready` — `email.live: true`.
4. Resend → delete the old key.

**Test outbound mail from CI** (nice-to-have — not required for launch):
Add a script that sends a "test" email to `deliverability-test@yourdomain`
and asserts the response ID is present. Wire it as a manual GitHub Actions
job so a human runs it — automating this consumes your daily quota.

**When you outgrow Resend free tier:**
- 3,000/month cap → upgrade to Pro ($20/month, 50k sends). If you're
  hitting this on the pilot, something is misconfigured.
- Alternative providers with the same adapter surface: SendGrid (bigger
  but heavier setup), Postmark (fastest transactional deliverability but
  strictest content policies).

---

## Failure mode reference

| Symptom | Root cause | Fix |
|---|---|---|
| Signup succeeds but no email arrives | RESEND_API_KEY not set | Set it in Render env vars |
| Signup returns "email failed" 500 | 4xx from Resend (invalid from) | Verify DNS in Phase B |
| Email arrives from `onboarding@resend.dev` | Rushed alternative left in EMAIL_FROM | Change to `no-reply@trustpe.in` once DNS verified |
| Email in Spam folder every time | New-sender reputation | Phase F warmup + wait a week |
| `[email] failed after retry` in logs | Persistent Resend outage | Check `status.resend.com`; open incident. OTPs will queue in stub mode if you set RESEND_API_KEY blank temporarily |
| Rate limit 429 on `/auth/signup` | User hit the 5/email/15-min cap | Working as designed; user waits 15 min |
| `_dmarc` record not verifying | Long value got wrapped in your DNS host's UI | Some UIs need quotes around the whole value; consult your DNS host's docs |

---

## Quick reference

- Resend dashboard: https://resend.com
- Resend status: https://status.resend.com
- API key format: `re_...`
- Env vars: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`
- Readiness probe: `GET /health/ready`
