# TrustPe Admin — Vercel Deploy Runbook

**Status:** ready-to-execute for the admin Next.js panel.
**Audience:** you.
**Companion docs:**
- [`DEPLOY_RENDER.md`](./DEPLOY_RENDER.md) — the backend goes to Render.
  Admin and backend are on different platforms deliberately.
- [`../admin/vercel.json`](../admin/vercel.json) — the Vercel config
  that tells the build how to handle the monorepo.

At the end of this runbook you have `https://trustpe-admin.vercel.app`
serving the Next.js admin panel, pointed at the Render-hosted backend
API, auto-deploying on every push to `main`.

---

## Why Vercel for admin, Render for backend?

**Vercel is the Next.js author's own hosting platform.** Zero-config
builds, edge caching, preview deployments per PR, generous free tier
(100 GB bandwidth/month — orders of magnitude more than admin needs).
The admin panel is a Next.js App Router app, so this is the native fit.

**Render is better for the Express + Socket.io backend.** Render's
free web service supports the persistent WebSocket the Socket.io
namespace needs. Vercel's serverless functions do not.

Splitting them across two providers costs zero extra (both free tiers)
and each app runs on the platform it's designed for.

---

## Phase A — Prerequisites (one-time, ~10 min)

1. **Vercel account.** [vercel.com/signup](https://vercel.com/signup) —
   sign up with the same GitHub account that hosts the TrustPe repo.
2. **Backend already deployed.** The admin needs a real
   `NEXT_PUBLIC_API_BASE_URL` — get the Render backend up first per
   `DEPLOY_RENDER.md`.
3. **`admin/vercel.json` is committed to the repo.** Already done.

---

## Phase B — Import the project (~5 min)

1. Vercel dashboard → **Add New → Project**.
2. Import the TrustPe GitHub repo.
3. On the "Configure Project" screen:
   - **Root Directory:** `admin` (click **Edit** → type `admin`).
     Vercel finds the `vercel.json` there and takes the settings from it.
   - **Build Command:** leave blank — `vercel.json` overrides it with
     `cd .. && bun install --frozen-lockfile && bun run --cwd admin build`.
   - **Output Directory:** leave blank — `vercel.json` sets it to `.next`.
   - **Install Command:** blank — the build command handles install.
   - **Framework Preset:** Next.js (auto-detected).
4. **Environment Variables** section, add:
   ```
   NEXT_PUBLIC_API_BASE_URL = https://trustpe-api.onrender.com
   ```
   (Or whatever your actual Render backend URL is. If you added a
   custom domain like `api.trustpe.in`, use that.)
5. Click **Deploy**. First build takes ~3–5 minutes.

### If the build fails at `bun install`

Vercel doesn't have Bun preinstalled the way Render does. Two options:

- **Recommended:** add a Node build hook that installs bun first. Edit
  `admin/vercel.json`:
  ```json
  {
    "buildCommand": "cd .. && npm install -g bun && bun install --frozen-lockfile && bun run --cwd admin build"
  }
  ```
- **Alternative:** switch the monorepo install to npm/pnpm workspaces
  (bigger change — don't do this unless bun keeps failing).

---

## Phase C — Verify (~2 min)

Open your Vercel URL — typically `trustpe-admin.vercel.app` (or the
custom name you gave the project). Sign in with an admin account.

- KYC queue should load, showing the pending reviews from the Render
  backend.
- Audit log page should load rows.
- If you get a CORS error in the browser console → update
  `CORS_ORIGINS` on the Render backend to include your Vercel URL:
  ```
  CORS_ORIGINS=https://trustpe-admin.vercel.app,https://trustpe.in
  ```
  Save on Render → the API restarts → try again.

---

## Phase D — Ongoing operations

### Auto-deploy on push

Vercel deploys automatically on every push to `main`. Every PR gets its
own **preview deployment** at a unique URL — great for reviewing UI
changes without touching prod.

### Preview URLs and CORS

Preview URLs look like `trustpe-admin-git-<branch>-<team>.vercel.app`.
If you want preview builds to hit the real backend, add a wildcard-ish
entry to the backend's `CORS_ORIGINS`:
```
CORS_ORIGINS=https://trustpe-admin.vercel.app,https://*.vercel.app,https://trustpe.in
```
Note: the backend's CORS middleware doesn't handle glob patterns by
default. If you want wildcards, either enumerate the preview URLs
manually or update `backend/src/app.ts` CORS setup to match by regex.

For the pilot, simplest is: use production-only from admin (no preview
UI review) and skip wildcards.

### Rollback

Vercel dashboard → project → **Deployments** → find last known-good →
**Promote to Production**. Instant, no rebuild.

### Log tail

`vercel logs trustpe-admin --follow` (needs `npm i -g vercel` and a
`vercel login`).

### Free-tier limits

- 100 GB bandwidth / month — the admin panel is text + minimal images,
  you'll consume single-digit GB even with heavy usage.
- 100 GB-hours of function execution — irrelevant here, no
  serverless functions.
- Preview deploys have a 45-minute build-time budget total per month
  across all previews. Not an issue at pilot scale.

---

## Failure-mode reference

| Symptom | Cause | Fix |
|---|---|---|
| Build fails at `bun: command not found` | Vercel container doesn't have bun preinstalled | Change buildCommand to `npm install -g bun && ...` |
| Build succeeds, admin shows "Failed to fetch" | `NEXT_PUBLIC_API_BASE_URL` wrong or backend down | Verify env var; hit `/health/ready` on the backend URL |
| Admin loads but every API call is CORS-blocked | `CORS_ORIGINS` on Render backend missing Vercel URL | Update env var on Render, redeploy |
| Push to `main` doesn't trigger a build | GitHub webhook detached from Vercel | Vercel dashboard → project → Settings → Git → reconnect |
| Preview deployment builds forever | You've hit the 45-min monthly budget | Wait for next month, or upgrade to Pro |
| Admin sign-in loops forever | Backend CORS blocks the cookie or the API URL scheme is `http` not `https` | Ensure `NEXT_PUBLIC_API_BASE_URL` is `https://...` |

---

## Quick reference

- Vercel config: [`../admin/vercel.json`](../admin/vercel.json)
- Backend deploy runbook: [`./DEPLOY_RENDER.md`](./DEPLOY_RENDER.md)
- Env vars (set at Vercel Project → Environment):
  - `NEXT_PUBLIC_API_BASE_URL` — the deployed backend URL
- CORS lives on the backend at `CORS_ORIGINS` (Render env var), not on
  Vercel
