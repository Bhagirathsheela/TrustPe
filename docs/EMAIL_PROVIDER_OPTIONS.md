# TrustPe — Email Provider Options

**Purpose:** compare the two supported email transports and their setup
paths. Pick one; the other is a fallback if you outgrow it.
**Audience:** you.
**Companion doc:** [`PRODUCTION_EMAIL_SETUP.md`](./PRODUCTION_EMAIL_SETUP.md)
covers Resend-specific setup in depth.

## Quick decision

| You want to... | Use |
|---|---|
| Ship a closed pilot to <50 friends today, no domain hassle | **SMTP (Gmail app password)** — Option A |
| List publicly on Play Store with a `no-reply@trustpe.in` sender | **Resend** — Option B |
| Test the app locally without touching real email | Leave both unset — stub mode |

The backend picks the first provider whose env vars are set:
1. `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` → SMTP wins
2. `RESEND_API_KEY` → Resend
3. Neither → stub mode (OTP prints to backend terminal)

You can leave both configured; SMTP takes priority. This is deliberate
so you can flip between them without deleting keys.

---

## Option A — SMTP (Gmail app password, zero cost)

**Cost:** ₹0.
**Domain needed:** No.
**Daily send cap:** 500 emails/day (personal Gmail). Way more than a
closed pilot needs.
**Deliverability:** Excellent — Gmail sending to Gmail, hardly ever hits
spam.
**Trade-off:** The recipient sees your Gmail address as the sender.
For friends-and-family this is actually a trust signal (they recognise
your name). For a public listing it looks amateur.

### Setup (10 minutes)

1. **Enable 2FA on your Google account.**
   https://myaccount.google.com/security → 2-Step Verification.
   Required — Google won't let you create an app password without 2FA.
2. **Create an app password.**
   https://myaccount.google.com/apppasswords → **App name:**
   `TrustPe backend` → **Create**. You get a 16-character code like
   `abcd efgh ijkl mnop`. **Copy it now — you can't see it again.**
   (Spaces in the code are OK to keep or drop.)
3. **Fill the backend env vars** (`backend/.env` or Render dashboard):
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=abcdefghijklmnop
   EMAIL_FROM=Your Name <yourname@gmail.com>
   EMAIL_REPLY_TO=yourname@gmail.com
   ```
   `EMAIL_FROM` should match `SMTP_USER` so Gmail doesn't add a "via"
   warning line for recipients. If you want the display name to say
   "TrustPe", use `TrustPe <yourname@gmail.com>` — Gmail allows this.
4. **Restart the backend.** `bun --cwd backend dev`.
5. **Smoke test.** Sign yourself up on the app. The OTP arrives in
   your inbox instead of the terminal.

### When to grow out of it

- You're sending >100 emails/day. (Personal Gmail cap is 500/day but
  Google throttles hard past ~100 for unknown senders.)
- You need to send from `no-reply@trustpe.in` for professionalism
  before Play Store review.
- You have a Google Workspace domain — that raises the cap to 2,000/day
  and is a mid-step between personal Gmail and Resend.

### Alternative SMTP providers with the same setup

Same env vars, just swap the host:

| Provider | Host | Port | Notes |
|---|---|---|---|
| Gmail personal | `smtp.gmail.com` | 465 | 500/day. App password required. |
| Google Workspace | `smtp.gmail.com` | 465 | 2000/day. App password required. |
| Zoho Mail (free) | `smtp.zoho.in` | 465 | Free 5-user Workspace with own domain. Better than Gmail for a small team. |
| Outlook.com | `smtp.office365.com` | 587 | Set `SMTP_SECURE=false` (STARTTLS on 587). |
| iCloud | `smtp.mail.me.com` | 587 | Set `SMTP_SECURE=false`. App password required. |
| Namecheap Private Email | `mail.privateemail.com` | 465 | If you already have a Namecheap domain, ~$10/yr for mail. |

---

## Option B — Resend (domain-verified, professional)

**Cost:** ₹0 for the first 3,000 emails/month, $20/month after.
**Domain needed:** Yes — you must verify a domain via DNS TXT + DKIM.
**Daily send cap:** 100/day on free tier (soft), can burst higher.
**Deliverability:** Excellent post-verification. Slightly worse than
Gmail-to-Gmail for personal Gmail recipients, better than SMTP for
corporate mailboxes.

Full walkthrough: [`PRODUCTION_EMAIL_SETUP.md`](./PRODUCTION_EMAIL_SETUP.md).

Short version:
1. Sign up at resend.com → create API key → paste as `RESEND_API_KEY`.
2. Add `trustpe.in` to Resend, paste the DNS records they show into
   your DNS host, wait for verification.
3. Set `EMAIL_FROM=TrustPe <no-reply@trustpe.in>`.
4. `EMAIL_REPLY_TO=support@trustpe.in` (mailbox you actually read).

Until DNS is verified you can use Resend's shared `onboarding@resend.dev`
sender — set `EMAIL_FROM=TrustPe <onboarding@resend.dev>` — but Gmail
will class it as promotional so this isn't a long-term answer.

---

## Verifying which provider is live

`GET /health/ready` returns the current provider:

```json
{
  "dependencies": {
    "email": {
      "ok": true,
      "live": true,
      "provider": "smtp",
      "from": "TrustPe <yourname@gmail.com>"
    }
  }
}
```

`provider` is one of `smtp`, `resend`, `stub`. If you see `stub` in
production, no email is going out.

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `[email:smtp] failed`: `Invalid login: 535-5.7.8 Username and Password not accepted` | Wrong Gmail password (used the account password, not an app password) | Generate an app password at myaccount.google.com/apppasswords |
| `[email:smtp] failed`: `EAUTH` | 2FA disabled on the Google account | Enable 2FA, then generate app password |
| Gmail shows "via mailer.gmail.com" line | `EMAIL_FROM` doesn't match `SMTP_USER` | Set both to the same address |
| Emails from SMTP land in Promotions / Updates tab | Gmail categorises unknown senders | Ask testers to move to Primary once, and it sticks |
| `[email:resend] failed`: `You can only send testing emails to your own email address` | Resend free tier before domain verification | Complete DNS verification for `trustpe.in` |
| No email at all + logs say `[email:stub]` | Neither SMTP nor Resend configured | Set env vars per Option A or B |

---

## Recommendation for TrustPe

**Weeks 1-4 (closed pilot with <20 users):** Option A, Gmail SMTP. Zero
cost, delivers reliably, your close circle sees your Gmail as sender
which they already trust.

**Weeks 5+ (approaching public listing):** switch to Option B, Resend
with verified `trustpe.in`. Keep the SMTP env vars set as a fallback so
if Resend has an outage you can flip `RESEND_API_KEY=` blank in the
Render dashboard and mail keeps flowing.
