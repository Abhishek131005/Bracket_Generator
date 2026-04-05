# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm ci --workspace=apps/web --include-workspace-root

COPY apps/web ./apps/web
# Web types reference api types
COPY apps/api/src/types.ts ./apps/api/src/types.ts

# VITE_API_URL can be set at build time if needed; defaults to /api via nginx proxy
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build --workspace=apps/web

# ── Stage 2: nginx static server ──────────────────────────────────────────────
FROM nginx:1.25-alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
