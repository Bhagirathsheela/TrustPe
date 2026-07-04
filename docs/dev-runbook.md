# TrustPe — Local Development Runbook

How to set up and run the TrustPe codebase locally.

---

## 0. One-time cleanup (only if upgrading from the pre-MVC scaffold)

If your local repo still has `apps/` and `packages/` folders from the earlier monorepo scaffold, delete them now (they're no longer used):

```powershell
# Windows PowerShell
Remove-Item -Recurse -Force E:\personal-work\TrustPe\apps
Remove-Item -Recurse -Force E:\personal-work\TrustPe\packages
Remove-Item -Force E:\personal-work\TrustPe\turbo.json
```

The new MVC layout uses `backend/`, `mobile/`, `admin/`, `shared/`.

---

## 1. Prerequisites

- **Node.js 20+** (see `.nvmrc`; use `nvm` if you have it)
- **Bun 1.1+** — `curl -fsSL https://bun.sh/install | bash` (or PowerShell: `powershell -c "irm bun.sh/install.ps1 | iex"`)
- **Docker Desktop** — for local MongoDB + Redis
- **Git** — `git config --global core.autocrlf input`
- For mobile work:
  - **Android Studio** (for SDK + emulator), OR
  - A real Android device with USB debugging enabled
  - **Expo Go** app installed on the device (Phase 1 dev only)

---

## 2. First-time setup

```bash
git clone <repo-url> trustpe
cd trustpe

# One install at the root — Bun workspaces handle all four folders
bun install

# Backend env
copy backend\.env.example backend\.env      # PowerShell
# Edit backend\.env and fill in your MongoDB Atlas URI + secrets

# Verify everything types and tests clean
bun run typecheck
bun run test
```

### Database

The default path uses **MongoDB Atlas** (no local install, free tier sufficient for our scale):

1. Sign up / log in at https://cloud.mongodb.com
2. Create a free shared cluster (M0)
3. Add a database user (Database Access)
4. Whitelist your IP or `0.0.0.0/0` for dev (Network Access)
5. Get the connection string: Connect → Drivers → Node.js
6. Paste into `backend/.env` as `MONGO_URI=...`

Optional alternative — fully local with Docker (if you prefer not to depend on Atlas):

```bash
docker compose up -d        # Starts Mongo replica-set + Redis + Mongo Express
# Then in backend/.env:
# MONGO_URI=mongodb://localhost:27017/trustpe?replicaSet=rs0
# REDIS_URL=redis://localhost:6379
```

Redis is not required for Sprint 1 — the OTP store falls back to in-memory. We wire real Redis in Sprint 3 when BullMQ workers and rate limiting come online.

---

## 3. Day-to-day commands

A comprehensive cheatsheet lives in **[`docs/COMMANDS.md`](COMMANDS.md)** — keep it open as a reference.

Quick essentials:

```bash
# From repo root:
bun run dev:backend      # Backend on :4000
bun run dev:admin        # Admin Next.js on :3001
bun run dev:mobile       # Expo dev server (scan QR)

bun run test             # All tests
bun run typecheck        # All four folders
bun run lint             # backend + admin + mobile
bun run format           # Prettier write across the repo
```

Or `cd` into a folder and use its local scripts:

```bash
cd backend && bun run dev
cd mobile && bun run dev
cd admin && bun run dev
```

---

## 4. Running the mobile app

### Option A: Real device via Expo Go (fastest for dev)

```bash
cd mobile && bun run dev
# Scan the QR code with the Expo Go app on your Android device
```

The device and laptop must be on the same Wi-Fi network.

### Option B: Android emulator

```bash
# Launch an AVD in Android Studio first
cd mobile && bun run dev
# Press 'a' in the Expo CLI to open on the emulator
```

### Option C: EAS Build APK (closer to production)

```bash
cd mobile
bunx eas build --profile development --platform android
# Install the resulting APK on your device
```

---

## 5. Useful URLs

| Service | URL |
|---|---|
| Backend health | http://localhost:4000/health |
| Backend API base | http://localhost:4000/v1 |
| Admin panel | http://localhost:3001 |
| Mongo Express (DB UI) | http://localhost:8081 (via docker-compose) |
| Expo dev tools | http://localhost:8081 (browser shown by Expo CLI) |

---

## 6. Common issues

**"bun install" fails on Windows.**
Bun on Windows requires WSL2 for some packages. Confirm WSL2 is enabled, or install/run Bun inside WSL.

**"Cannot connect to MongoDB."**
`docker ps` should show `trustpe-mongo` running. Confirm `MONGO_URI` in `backend/.env` matches.

**"Cannot find module '@shared/...'" in backend.**
The path alias is configured in `backend/tsconfig.json` and `backend/vitest.config.ts`. If you added a new entry to `shared/`, restart your editor's TypeScript server.

**"Cannot find module '@shared/...'" in mobile.**
The alias is configured in `mobile/babel.config.js`, `mobile/metro.config.js`, and `mobile/tsconfig.json`. Restart the Expo dev server after changes to those files.

**"Cannot find module '@shared/...'" in admin.**
Configured in `admin/tsconfig.json` and `admin/next.config.mjs` webpack alias. Restart `next dev` after changes.

**Bun + Expo conflicts.**
If `bun expo ...` misbehaves, use `bunx expo ...` or `npx expo ...`. EAS Build itself uses npm in the cloud, which is fine.

**Expo version-mismatch warnings (`Your project may not work correctly...`).**
Run `cd mobile && bunx expo install --fix`. This pins every Expo-managed package (`expo-*`, `react`, `react-native`, etc.) to the exact version the installed Expo SDK expects.

**"Project is incompatible with this version of Expo Go" on the device.**
The Expo Go app on your phone is for a newer SDK than the project. Either:
- Upgrade the project's `expo` version to match (then `bunx expo install --fix`), or
- Install the older Expo Go variant for your project's SDK from expo.dev's "older versions" page.
We're on SDK 54 as of v0.6 of the architecture.

---

## 7. Folder layout reminder

```
trustpe/
├── backend/        Express + TS backend (MVC: config/models/controllers/routes/services/middleware/...)
├── mobile/         React Native Expo Android user app
├── admin/          Next.js admin panel
├── shared/         Zod schemas + TS types + constants (imported as @shared/*)
└── docs/           Architecture, testing, build plan, runbooks
```

See `CLAUDE.md` for the conventions every code change must follow.

---

## 8. What to read next

- `docs/ARCHITECTURE.md` for the system design
- `docs/BUILD_PLAN.md` for the current sprint
- `docs/TESTING.md` for testing strategy
- `CLAUDE.md` for engineering conventions
