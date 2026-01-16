# syntax=docker/dockerfile:1.4

# ---------- base ----------
FROM node:20-alpine AS base
WORKDIR /app
ENV CI=true
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable


# ---------- deps ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY apps/web/package.json ./apps/web/package.json
# Встановлюємо тільки залежності, потрібні Next-додатку та спільним пакетам
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile \
    --filter ./apps/web... \
    --filter ./packages/shared... \
    --filter ./packages/types...


# ---------- build ----------
FROM deps AS build
# Приймаємо build-арги від compose
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .
# Вимикаємо телеметрію і будуємо лише web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter ./apps/web build


# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable


COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static


EXPOSE 3000
CMD ["node", "apps/web/server.js"]
