# TrustPe — Production Email Setup

**Status:** ready-to-execute runbook for turning on real transactional
email (OTP signup / login + KYC decisions) using **Gmail SMTP with an
app password**. Zero cost, no domain required.
**Audience:** you.

At the end of this runbook, when a user hits **Sign up** or **Log in**
on the app, a branded TrustPe email lands in their Gmail inbox within
seconds. Until you do this, OTPs only appear in the backend logs.

---

## Why Gmail SMTP

- **₹0 cost.** Uses your existing personal Gmail.
- **No DNS setup.** Send from `yourname@gmail.com` — no SPF/DKIM/DMARC.
- **~500 emails/day.** Way above pilot need (you'd hit MongoDB Atlas
  connection limits long before you hit this).
- **Excellent deliverability.** Gmail-to-Gmail rarely lands in spam.
- **Recognisable sender.** Your friends already know your Gmail address —
  a welcome trust signal for the closed pilot.

Trade-off: recipients see your Gmail as the sender. For friends-and-family
this is a feature. For a public Play Store listing later, upgrade to a
proper SMTP host or Resend with a verified `trustpe.in` domain — the
env-var swap is documented at the bottom of this doc.

---

## Phase A — Prepare your Google account (~5 min)

1. **Enable 2-Factor Authentication** on your Google account (required
   by Google before it will let you create an app password):
   https://myaccount.google.com/security → 2-Step Verification.
2. **Create an app password:**
   https://myaccount.google.com/apppasswords → **App name:**
   `TrustPe backend` → **Create**. Google shows a 16-character code
   like `abcd efgh ijkl mnop`.
3. **Copy it now — you can't see it again.** Spaces in the code are
   optional (Nodemailer handles either way).

---

## Phase B — Local test (~2 min)

Fill the SMTP block in `backend/.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=yourname@gmail.com
SMTP_PASS=abcdefghijklmnop
EMAIL_FROM=TrustPe <yourname@gmail.com>
EMAIL_REPLY_TO=yourname@gmail.com
```

`EMAIL_FROM` should match `SMTP_USER` so Gmail doesn't add a "via
mailer.gmail.com" warning to recipients. You can use a display name like
`TrustPe <yourname@gmail.com>` — Gmail allows this.

Restart the backend:

```bash
bun --cwd backend dev
```

Sign yourself up on the mobile app (or the admin panel — anything that
triggers an OTP). The OTP should hit your Gmail inbox within seconds
with subject "Confirm your TrustPe signup".

If nothing arrives, check the backend logs for `[email:stub]` (means
env vars weren't picked up — restart), `[email] failed: Invalid login`
(means wrong app password), or `[email] failed: EAUTH` (means 2FA isn't
enabled).

---

## Phase C — Set the same vars on Render (~2 min)

Render dashboard → `trustpe-api` → **Environment**:

| Key | Value |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` (already set by render.yaml) |
| `SMTP_PORT` | `465` (already set) |
| `SMTP_SECURE` | `true` (already set) |
| `SMTP_USER` | your Gmail |
| `SMTP_PASS` | the 16-character app password |
| `EMAIL_FROM` | `TrustPe <yourgmail@gmail.com>` |
| `EMAIL_REPLY_TO` | `yourgmail@gmail.com` |

Save → Render restarts the service.

---

## Phase D — Verify (~1 min)

```bash
curl https://trustpe-api.onrender.com/health/ready | jq
```

Expected response includes:
```json
{
  "dependencies": {
    "email": { "ok": true, "live": true, "from": "TrustPe <yourgmail@gmail.com>" }
  }
}
```

Then sign up on the production mobile build with a different Gmail
address (not your own — the point is to prove it works for other people).
The OTP should arrive within 10 seconds.

---

## Phase E — Reputation warmup

For the first ~50 sends after Gmail sees your app-password sending
pattern, some recipients' Gmails may still class the email as
Promotions rather than Primary. Ask early testers to:
- Move the first TrustPe email from **Promotions** or **Updates** to
  **Primary**. Google learns from this.
- Add `yourgmail@gmail.com` to their contacts.

That's it. There's no DNS to wait on.

---

## Ops — Rotate the app password (quarterly, or after compromise)

1. Revoke the current app password at
   https://myaccount.google.com/apppasswords → find "TrustPe backend"
   → **Delete**.
2. Create a new one, same name.
3. Update `SMTP_PASS` in Render → save.
4. Update `SMTP_PASS` in local `backend/.env`.

---

## Upgrade path — when to move off Gmail SMTP

- **You're sending >100 emails/day.** Google throttles hard past ~100
  for unknown app-password senders.
- **You're going public** on Play Store's Production track with a
  `trustpe.in` domain — no-reply@trustpe.in looks more professional
  than a personal Gmail.

When either of those happens, add the `resend` package back and set
`RESEND_API_KEY`. The email service is designed for the swap — see the
git history for the Sprint 5F Resend integration.

---

## Failure-mode reference

| Symptom | Cause | Fix |
|---|---|---|
| Signup returns 502 `otp_delivery_failed` | Backend can't reach Gmail SMTP | Check backend logs for the actual Nodemailer error |
| `Invalid login: 535-5.7.8 Username and Password not accepted` | Wrong password — used the account password, not an app password | Generate an app password at myaccount.google.com/apppasswords |
| `EAUTH` in backend logs | 2FA not enabled on the Google account | Enable 2FA, then generate app password |
| Emails land in Promotions / Updates tab | Gmail categorises unknown senders | Ask testers to move the first one to Primary — it sticks |
| `[email:stub] Would send` in logs even though SMTP_* is set | Env not picked up | Restart backend / redeploy on Render |
| Signup succeeds but no email arrives | `SMTP_PASS` blank in Render env | Set it in dashboard → save |
| No email + no logs | Recipient's Gmail rejected it silently | Rare — check your Gmail's Sent folder to see if it was actually delivered |
