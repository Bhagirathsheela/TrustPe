# TrustPe — Render Deploy Runbook

**Status:** ready-to-execute for the first production deploy of the
backend API + admin panel.
**Audience:** Bhagirath (you).
**Companion docs:**
- [`PRODUCTION_EMAIL_SETUP.md`](./PRODUCTION_EMAIL_SETUP.md) — email
  provider, done before this.
- [`PLAY_STORE_LAUNCH_CHECKLIST.md`](./PLAY_STORE_LAUNCH_CHECKLIST.md) —
  mobile app distribution, done after this.

At the end of this runbook you have the Express + Socket.io backend
live on Render, auto-deploying on every push to `main`. The admin panel
lives on Vercel — see [`DEPLOY_VERCEL_ADMIN.md`](./DEPLOY_VERCEL_ADMIN.md).

The IaC config lives at [`../render.yaml`](../render.yaml). Read that
file for the exact service shape; this runbook is the human procedure.

---

## Phase A — Prerequisites (one-time, ~30 min)

1. **Render account.** [render.com/register](https://render.com/register)
   — free tier is enough for the closed pilot.
2. **Payment method on file.** Even for free tier — Render blocks
   Blueprint deploys without one, presumably to reduce spam.
3. **Repo push access.** Render pulls from your GitHub / GitLab. Connect
   the account in Render → Account Settings → GitHub.
4. **DNS control for `trustpe.in`.** You'll add `CNAME` records for
   `api.trustpe.in` and `admin.trustpe.in` in Phase E.
5. **Prod values ready to paste:**
   - MongoDB Atlas connection string (production cluster, not dev)
   - Cloudinary cloud name + API key + API secret
   - Resend API key (from `PRODUCTION_EMAIL_SETUP.md` Phase A)
   - Sentry DSN (optional; can be added later)

---

## Phase B — First Blueprint deploy (~10 min + build wait)

1. Render dashboard → **New +** → **Blueprint**.
2. Select the TrustPe repo. Branch: `main`.
3. Render finds `render.yaml` at the repo root and shows two services:
   `trustpe-api` and `trustpe-admin`.
4. Under `trustpe-api`, paste secrets into the `sync: false` slots:
   - `MONGO_URI` — the SRV string from Atlas
   - `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET`
   - `RESEND_API_KEY`
   - `SENTRY_DSN` (leave blank if not yet set up)
5. Under `trustpe-admin`, no secrets to paste — it inherits the API URL
   from the `trustpe-api` service via `fromService`.
6. Click **Apply**. Render builds both services in parallel. First
   build ~5–8 minutes.

### What Render is doing during first build

- Installs Node 20 in the build container.
- Runs `bun install --frozen-lockfile` (workspaces install, ~90 s).
- Runs `bun run --cwd backend build` (TypeScript transpile).
- Health-checks `GET /health/ready`. Expects 200 within 90 s.
- If the health check fails, the deploy is rolled back and the previous
  build stays live (or, on first-ever deploy, the service is marked as
  failed and stays offline).

### First-build failure debugging

- Render **Events** tab shows the step that failed (install / build /
  start / health-check).
- Render **Logs** tab shows the full runtime stderr.
- Common causes:
  - **Health check fails** — usually MongoDB URI wrong or the network
    doesn't allow the connection. Atlas IP allowlist must include
    `0.0.0.0/0` for Render Free (it doesn't publish a static IP block).
  - **Build fails at `bun install`** — bun.lock outdated. Run `bun install`
    locally, commit the updated lockfile.
  - **`Cannot find module 'trustpe-shared'`** — workspace symlink didn't
    resolve. Confirm `backend/package.json` has
    `"trustpe-shared": "workspace:*"` and root `package.json` lists
    `shared` in `workspaces`.

---

## Phase C — Verify the deploy (~2 min)

Once both services are green:

```bash
# Liveness — always 200 if the process is up
curl https://trustpe-api.onrender.com/health

# Readiness — 200 only when DB is connected, JWT + Cloudinary + email are set
curl https://trustpe-api.onrender.com/health/ready | jq
```

Expected output:
```json
{
  "ok": true,
  "env": "production",
  "dependencies": {
    "database":   { "ok": true, "state": "connected" },
    "email":      { "ok": true, "live": true, "from": "TrustPe <no-reply@trustpe.in>" },
    "jwt":        { "ok": true },
    "cloudinary": { "ok": true }
  }
}
```

Any `ok: false` — fix the corresponding env var and re-deploy. Fastest
re-deploy: **Manual Deploy → Deploy latest commit**.

---

## Phase D — Custom domains + TLS (~10 min + DNS wait)

1. **Backend →** Render dashboard → `trustpe-api` → Settings → Custom
   domains → **Add** `api.trustpe.in`.
2. Render shows the `CNAME` value (e.g. `trustpe-api.onrender.com`).
3. In your DNS host (Cloudflare / Route 53 / registrar), add:
   ```
   CNAME  api      trustpe-api.onrender.com
   ```
4. Repeat for admin: `trustpe-admin` → Custom domains →
   **Add** `admin.trustpe.in` → CNAME.
5. Render auto-provisions Let's Encrypt certificates once DNS
   propagates (~2–10 min). Both endpoints then serve HTTPS.
6. Update `CORS_ORIGINS` on `trustpe-api` to include both the admin
   domain and any user-facing trustpe.in surfaces:
   ```
   CORS_ORIGINS=https://admin.trustpe.in,https://trustpe.in
   ```
7. Update the mobile app's `EXPO_PUBLIC_API_BASE_URL` (in
   `mobile/eas.json` production env) to `https://api.trustpe.in` and
   rebuild the AAB.

---

## Phase E — Wire mobile + admin at the deployed API

Mobile:
- `mobile/eas.json` production profile → confirm
  `EXPO_PUBLIC_API_BASE_URL: https://api.trustpe.in` (added in the
  Sprint 5 Play Store prep).
- Rebuild the AAB: `bunx eas build --platform android --profile production`.

Admin:
- `render.yaml` already threads `NEXT_PUBLIC_API_BASE_URL` from
  `trustpe-api` via `fromService.property: host`. Once `trustpe-admin`
  redeploys, the API URL is set automatically.
- Verify by opening https://admin.trustpe.in and signing in — the
  KYC queue should load.

---

## Phase F — Ongoing operations

### Deploy on every push to main

Default behaviour once the Blueprint is set up. Push to `main` → Render
auto-builds → health-checks → cuts traffic over. Previous build stays
warm for ~10 min as a rollback target.

Watch the deploy live:
```bash
# Requires the Render CLI (npm install -g @render/cli)
render logs --service=trustpe-api --tail
```

### Rollback

- Render dashboard → `trustpe-api` → Deploys → find the last known-good
  deploy → **Rollback**.
- Rollback is instant — no rebuild. Uses the artifact Render already
  has cached.
- Rollback also restores the env-var state as of that deploy, so a bad
  env-var change gets reverted with the code.

### Rotate a secret

1. Get the new value ready.
2. Render dashboard → `trustpe-api` → Environment → find the key →
   Edit → paste new value → Save Changes.
3. Render restarts the service (~15 s). Health-check must pass.
4. If the health-check fails, restore the old value and investigate.

### Tail logs

```bash
render logs --service=trustpe-api --tail
```

The tracker (Sentry-shaped stub) logs uncaught errors at `error` level
with a `[tracker]` prefix. Grep for that in the tail to spot
production regressions early.

### Free-tier sleep

Render Free web services sleep after 15 minutes of inactivity. First
request after sleep takes ~30 s. Symptoms your users will report:
"the app was slow the first time I opened it after not using it for a
while." Fix at pilot scale by upgrading `trustpe-api` to Starter
($7/month) — the admin can stay on Free.

### Manual redeploy without a code change

Render dashboard → `trustpe-api` → **Manual Deploy → Deploy latest
commit**. Useful when you've only changed env vars.

---

## Phase G — Database migrations (Phase 1: no-op)

Phase 1 uses Mongoose — schemas evolve without formal migration files.
Index changes get applied automatically on service boot via
`Model.createIndexes()` under the hood.

**If you ever add data-shape migrations** (Phase 2+):
1. Create `backend/src/migrations/<timestamp>-<name>.ts`.
2. Add a start-of-boot migration runner in `server.ts` behind a feature
   flag env var so a bad migration can be disabled without a code push.
3. Run the migration once in a maintenance window, then remove the
   feature flag env.

Don't ship a migration that isn't idempotent — Render can restart the
service at any moment, so a partially-applied migration must be safe to
re-run.

---

## Phase H — Failure-mode reference

| Symptom | Likely cause | Fix |
|---|---|---|
| Deploy stuck "Building..." for >15 min | Free-tier build slot queued behind other users | Wait; Render will pick it up. Consider Starter for build-time SLA |
| Deploy fails at "Starting" step | Health check fails within 90 s | Check `MONGO_URI` and Atlas IP allowlist (add `0.0.0.0/0`) |
| Health check returns 503 in production | Missing env var (email, JWT, Cloudinary) | Check `/health/ready` body — fix the `ok: false` dependency |
| Signup returns 502 `otp_delivery_failed` | Resend rejects the from-domain | Verify DNS records for `trustpe.in` in Resend (Phase B of email setup) |
| `Cannot find module 'trustpe-shared'` in logs | Workspace symlink didn't resolve during build | Confirm `bun.lock` was pushed; try Manual Deploy → Clear build cache |
| CORS errors in admin browser | `CORS_ORIGINS` doesn't include the admin domain | Update env var; Manual Deploy |
| First request after 15 min hangs | Free-tier sleep | Upgrade `trustpe-api` to Starter tier |
| Env var change didn't take effect | Render didn't restart | Manual Deploy → Deploy latest commit |
| Suddenly getting 429 from Atlas | Cluster over-quota (free tier has connection cap) | Upgrade to Atlas M2/M5 shared cluster (~$9/mo) |

---

## Quick reference

- IaC config: [`../render.yaml`](../render.yaml)
- Docker path (optional): [`../backend/Dockerfile`](../backend/Dockerfile)
  — not used by Render Blueprint, kept for local reproducibility
- Env-var checklist (values you paste at Blueprint apply):
  `MONGO_URI`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, `SENTRY_DSN` (optional)
- Health probes: `GET /health` (liveness), `GET /health/ready` (readiness)
- Log tail: `render logs --service=trustpe-api --tail`
- Rollback: dashboard → Deploys → Rollback
