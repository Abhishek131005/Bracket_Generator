# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
# Web package.json needed for workspace resolution even in API-only build
COPY apps/web/package.json ./apps/web/

RUN npm ci --workspace=apps/api --include-workspace-root

COPY apps/api ./apps/api

# Generate Prisma client and compile TypeScript
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm ci --workspace=apps/api --include-workspace-root --omit=dev

# Copy compiled output and Prisma schema (needed for migrations at runtime)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY apps/api/prisma ./apps/api/prisma

# Entrypoint runs migrations then starts the server
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh

EXPOSE 4000

CMD ["./apps/api/docker-entrypoint.sh"]
