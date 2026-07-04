# TrustPe — Commands Cheatsheet

Every command you'll run during development, in one place. Bookmark this.

All root-level scripts run from `E:\personal-work\TrustPe\` (or wherever you cloned the repo). Per-folder commands assume you've `cd`'d into that folder.

---

## 1. First-time and one-time setup

```bash
# Clone (skip if you already have the repo)
git clone <repo-url> trustpe
cd trustpe

# One-time cleanup of leftover monorepo folders (only if upgrading from pre-MVC scaffold)
# Windows PowerShell:
Remove-Item -Recurse -Force apps
Remove-Item -Recurse -Force packages
Remove-Item -Force turbo.json

# Install ALL dependencies in one shot (Bun workspaces handle backend, mobile, admin, shared together)
bun install

# Create backend env file from template, then fill in real values
copy backend\.env.example backend\.env       # PowerShell
# or:  cp backend/.env.example backend/.env  # bash

# Start local Mongo + Redis (Docker Desktop must be running)
docker compose up -d

# Stop them later with:
docker compose down
```

---

## 2. Run dev servers

Run each in a separate terminal:

```bash
bun run dev:backend     # Express API on http://localhost:4000
bun run dev:admin       # Next.js admin on http://localhost:3001
bun run dev:mobile      # Expo dev server (scan QR code with Expo Go on Android)
```

Equivalent forms if you prefer:

```bash
cd backend && bun run dev
cd admin   && bun run dev
cd mobile  && bun run dev
```

For mobile specifically, after the Expo dev server starts you can press:

- `a` to open on a connected Android emulator
- Scan the QR code in your Expo Go app (real device on same Wi-Fi)
- `r` to reload, `m` for menu, `j` to open Chrome devtools

---

## 3. Type checking

```bash
bun run typecheck             # All four folders (shared → backend → admin → mobile)

bun run typecheck:shared      # Just shared/
bun run typecheck:backend     # Just backend/
bun run typecheck:admin       # Just admin/
bun run typecheck:mobile      # Just mobile/
```

---

## 4. Linting

```bash
bun run lint                  # backend + admin + mobile

bun run lint:backend
bun run lint:admin
bun run lint:mobile
```

(shared has no lint config — it's just types and zod schemas.)

---

## 5. Tests

```bash
bun run test                  # All four folders

bun run test:shared           # Just shared/ (smoke tests on types)
bun run test:backend          # Backend integration + unit tests
bun run test:admin            # Admin unit tests
bun run test:mobile           # Mobile unit tests
```

Per-folder watch mode (run inside the folder):

```bash
cd backend && bun run test:watch
cd shared  && bun run test:watch
```

Backend-specific test types:

```bash
cd backend
bun run test:unit             # Just tests/unit/
bun run test:integration      # Just tests/integration/
```

---

## 6. Formatting

```bash
bun run format                # Prettier write across the whole repo
bun run format:check          # Check only — fails if anything needs formatting
```

---

## 7. Mobile-specific (Expo / EAS)

From the `mobile/` folder:

```bash
cd mobile

# Dev
bun run dev                          # = expo start
bun run android                      # = expo start --android (open emulator)

# Pin every Expo-managed package to the exact version the installed SDK expects.
# Run this after any expo SDK bump or whenever Expo prints version-mismatch warnings.
bunx expo install --check            # Diagnose
bunx expo install --fix              # Auto-fix all package versions

# Builds via EAS (cloud)
bun run build:dev                    # Development client APK
bun run build:preview                # Internal-distribution preview APK
bun run build:prod                   # Production app bundle

# Other EAS / Expo commands you'll occasionally need
bunx expo prebuild                   # Generate native projects (only if needed)
bunx eas login                       # Authenticate with Expo
bunx eas device:create               # Register a device for internal distribution
bunx eas update --branch preview     # Push OTA update to preview channel
```

---

## 8. Backend-specific

From the `backend/` folder:

```bash
cd backend

bun run dev                          # tsx watch src/server.ts
bun run build                        # tsc → dist/
bun run start                        # Run the built version
bun run lint
bun run typecheck
bun run test
bun run test:unit
bun run test:integration
bun run test:watch
```

Health check (server must be running):

```bash
curl http://localhost:4000/health
# Expected: {"ok":true,"service":"trustpe-backend",...}
```

---

## 9. Docker (local infrastructure)

```bash
docker compose up -d                 # Start Mongo + Redis + Mongo Express
docker compose ps                    # Confirm they're running
docker compose logs -f mongo         # Tail Mongo logs
docker compose down                  # Stop everything
docker compose down -v               # Stop AND wipe volumes (clean reset)
```

Mongo Express UI: http://localhost:8081

---

## 10. Git workflow (suggested)

```bash
git checkout -b feature/<short-name>     # Start a feature branch
# make changes
bun run typecheck && bun run test         # Verify locally
git add -A
git commit -m "feat: describe change"
git push -u origin feature/<short-name>
# Open PR on GitHub, CI runs automatically
```

---

## 11. Troubleshooting commands

```bash
# Reset node_modules entirely
Remove-Item -Recurse -Force node_modules   # PowerShell
bun install

# See what Bun thinks is installed
bun pm ls

# Check which Bun version
bun --version

# Restart TypeScript server in VS Code
# Cmd/Ctrl+Shift+P → "TypeScript: Restart TS Server"

# When Metro caching breaks the mobile app
cd mobile
bunx expo start --clear

# When Next.js caching breaks the admin
cd admin
Remove-Item -Recurse -Force .next   # PowerShell
bun run dev
```

---

## 12. Quick reference table

| Goal | Command |
|---|---|
| Install everything | `bun install` |
| Start backend | `bun run dev:backend` |
| Start admin | `bun run dev:admin` |
| Start mobile | `bun run dev:mobile` |
| Run all tests | `bun run test` |
| Typecheck everything | `bun run typecheck` |
| Lint everything | `bun run lint` |
| Format everything | `bun run format` |
| Start local DB | `docker compose up -d` |
| Stop local DB | `docker compose down` |
| Health check | `curl http://localhost:4000/health` |
| Build mobile APK | `cd mobile && bun run build:preview` |

---

## 13. Common script aliases (per folder)

Every workspace (`backend`, `mobile`, `admin`, `shared`) exposes the same canonical script names where applicable:

| Script | What it does (where applicable) |
|---|---|
| `bun run dev` | Start the dev server / watcher |
| `bun run build` | Compile / bundle production output |
| `bun run start` | Run the production build |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript noEmit check |
| `bun run test` | Vitest run once |
| `bun run test:watch` | Vitest watch mode |
| `bun run format` | Prettier write |

So `cd backend && bun run dev` works the same way as `bun run dev:backend` from the root.
