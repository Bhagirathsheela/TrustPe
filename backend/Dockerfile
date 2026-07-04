# TrustPe backend — optional Docker path.
#
# Not required for Render Blueprint deploys (see ../render.yaml) — the
# Node runtime handles our monorepo layout fine. Kept here for:
#   - Local reproducibility (`docker build -t trustpe-api backend/`)
#   - Emergency deploy to any other Docker host (Fly, Railway, EC2)
#   - CI smoke builds that catch "works on my machine" breakage
#
# Multi-stage: builder installs everything and transpiles; runtime keeps
# only the compiled JS + production deps + a non-root user.

# ────────────── Stage 1: builder ──────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Bun for the monorepo install (workspaces + fast install).
# If you'd rather stick with npm, replace bun below with npm workspaces.
RUN apk add --no-cache curl bash \
    && curl -fsSL https://bun.sh/install | bash \
    && ln -s /root/.bun/bin/bun /usr/local/bin/bun

# Copy the workspace manifest + lockfile first so `bun install` layer
# caches across code changes.
COPY package.json bun.lock tsconfig.base.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY admin/package.json admin/
COPY mobile/package.json mobile/

RUN bun install --frozen-lockfile

# Copy the sources needed to build the backend + its shared dep.
COPY shared shared
COPY backend backend

RUN bun run --cwd backend build

# ────────────── Stage 2: runtime ──────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Non-root user so a compromised process can't touch the host.
RUN addgroup -S trustpe && adduser -S trustpe -G trustpe

# Copy only production artifacts + prod deps.
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER trustpe

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Simple healthcheck — Render / Docker orchestrators use this to know
# whether to send traffic. Uses the /health/ready readiness probe added
# in Sprint 5, so we don't route traffic to a booting container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget --spider -q http://localhost:${PORT}/health/ready || exit 1

CMD ["node", "backend/dist/server.js"]
