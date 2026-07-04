# TrustPe

India's trust-based peer-to-peer lending marketplace.

Phase 1 is a closed friends-and-family pilot built as an Android React Native (Expo) user app, a Next.js admin panel, and a Node.js + Express backend with MongoDB.

## Quick start

Prerequisites:

- Node.js 20+ (`.nvmrc` provided)
- Bun 1.1+ ([install](https://bun.sh/docs/installation))
- Docker (for local MongoDB + Redis)
- For mobile: Android Studio or a real Android device with USB debugging

```bash
# One install at the root (Bun workspaces handle all four folders)
bun install

# Start MongoDB + Redis
docker compose up -d

# Run each app (in separate terminals)
bun run dev:backend     # http://localhost:4000
bun run dev:admin       # http://localhost:3001
bun run dev:mobile      # Expo dev server, scan QR with Expo Go
```

See `docs/dev-runbook.md` for the development guide and `docs/COMMANDS.md` for a complete commands cheatsheet.

## Repository structure

```
trustpe/
├── backend/        Express + TypeScript backend (MVC)
│   ├── src/
│   │   ├── config/        env, database, redis
│   │   ├── models/        Mongoose schemas
│   │   ├── controllers/   request handlers (thin)
│   │   ├── routes/        Express routers
│   │   ├── services/      business logic + external API calls
│   │   ├── middleware/    auth, validation, error
│   │   ├── jobs/          BullMQ workers (Sprint 3+)
│   │   ├── socket/        Socket.io (Sprint 2+)
│   │   ├── utils/
│   │   └── server.ts
│   └── tests/
├── mobile/         React Native (Expo) Android user app
├── admin/          Next.js admin panel
├── shared/         Zod schemas, TS types, constants — imported via @shared/*
└── docs/           Architecture, testing, build plan, runbooks
```

## Documents

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, decisions, Phase 1 scope
- [`docs/ONBOARDING_FLOW.md`](docs/ONBOARDING_FLOW.md) — end-to-end user + admin onboarding flow (single-step KYC with UPI bound inside)
- [`docs/REGULATIONS_AND_MONETIZATION.md`](docs/REGULATIONS_AND_MONETIZATION.md) — Indian P2P regulation, competitor analysis, monetization strategy, scaling paths
- [`docs/PLAY_STORE_DISTRIBUTION.md`](docs/PLAY_STORE_DISTRIBUTION.md) — runbook for distributing the app to your closed circle via Play Store's Internal/Closed testing tracks
- [`docs/TESTING.md`](docs/TESTING.md) — testing strategy and per-feature test plans
- [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) — 6-sprint roadmap
- [`docs/dev-runbook.md`](docs/dev-runbook.md) — local development guide
- [`docs/COMMANDS.md`](docs/COMMANDS.md) — commands cheatsheet (every dev/test/lint/typecheck command)
- [`docs/sprint-status.md`](docs/sprint-status.md) — current sprint status
- [`CLAUDE.md`](CLAUDE.md) — guidance for LLM-assisted development
- [`.cursorrules`](.cursorrules) — Cursor IDE rules

## Status

Phase 1 — Closed Friends-and-Family Pilot. Sprint 1 (Auth + Profile + KYC with UPI bound inside KYC) complete; Sprint 2 (loans + offers + agreement) next.

See `docs/sprint-status.md` for live sprint status and `docs/ONBOARDING_FLOW.md` for the current onboarding flow.

## License

Proprietary — all rights reserved.
