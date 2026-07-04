# TrustPe Backend

Express + TypeScript backend for TrustPe.

Follows MVC layering:

```
src/
├── config/         env, database, redis config
├── models/         Mongoose schemas (User, Profile, Loan, Payment, ...)
├── controllers/    request handlers — thin: parse → call service → format response
├── routes/         Express routers, one file per resource
├── services/       business logic + external API integrations
├── middleware/     auth, validation, error handling, rate limit
├── jobs/           BullMQ workers (added Sprint 3)
├── socket/         Socket.io setup and event handlers (added Sprint 2)
├── utils/          logger, jwt, crypto, formatters
├── types/          backend-only TypeScript types
└── server.ts       entry point
```

Shared zod schemas and TS types live in `../shared/` and are imported via the
`@shared/*` path alias.

## Running locally

```bash
cp .env.example .env
# Edit .env

bun install
bun run dev
# Server on http://localhost:4000
curl http://localhost:4000/health
```

## Tests

```bash
bun test                  # all tests
bun run test:unit         # unit tests only
bun run test:integration  # integration tests only
bun run test:watch        # watch mode
```

See `docs/TESTING.md` for the testing strategy and per-feature plans.
