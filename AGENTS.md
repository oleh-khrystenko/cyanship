# LucidKit
> Monorepo з Next.js 16 frontend і NestJS 11 API для локалізованого auth-centric застосунку зі спільними TypeScript/Zod контрактами.

## Tech Stack
- **Core:** TypeScript 5.9, Node.js 20 (Docker/CI), Next.js 16 + React 19 (`apps/web`), NestJS 11 (`apps/api`).
- **Data:** MongoDB 7 + Mongoose (`apps/api/src/modules/users/schemas/user.schema.ts`), Redis 7 для auth token state (`apps/api/src/common/providers/redis.provider.ts`).
- **Infra:** pnpm workspaces (`pnpm-workspace.yaml`), Turborepo (`turbo.json`), Docker Compose (`docker-compose.yml`, `docker-compose.dev.yml`), GitHub Actions CI (`.github/workflows/ci.yml`).
- **Libs:** `next-intl`, `zustand`, `axios`, `next-themes`, `nestjs-zod` + `zod`, `passport-google-oauth20`, `passport-jwt`, `ioredis`, `resend`.

## Architecture Overview
Модульний monorepo-моноліт з двома runtime apps (`web`, `api`) і одним shared contracts пакетом (`packages/types`).

- **Backend layer (`apps/api/src`):**
  - `main.ts` задає global prefix `/api`, CORS, `ZodValidationPipe`, `AllExceptionsFilter`.
  - `AppModule` компонує feature modules: `auth`, `users`, `reports`, `storage`, `payments`.
  - Auth flow: OAuth/MagicLink -> JWT pair issuance -> refresh rotation/revocation через Redis.
- **Frontend layer (`apps/web/src`):**
  - Next App Router з locale segment `app/[locale]`.
  - Global layout піднімає `AuthInitializer` + `Header`; protected routes обгорнуті в `AuthGuard`.
  - `middleware.ts` робить edge-level redirects на основі `bid_refresh` cookie.
  - API access через `shared/api/client.ts` (axios, in-memory access token, 401 auto-refresh).
- **Shared contracts (`packages/types/src`):**
  - Єдині `LANG`, `ERROR_CODE`, `AuthResponseSchema`, `SendMagicLinkSchema`, `VerifyMagicLinkSchema`, `UserProfileSchema` для FE/BE.

## Project Structure
- `apps/api/src/main.ts` — bootstrap API (global filters/pipes/CORS/prefix).
- `apps/api/src/app.module.ts` — composition root API modules.
- `apps/api/src/modules/auth` — OAuth, Magic Link, JWT refresh rotation, email sending.
- `apps/api/src/modules/users` — Mongo user model + profile/credits operations.
- `apps/api/src/common` — cross-cutting concerns (guard/filter/decorator/redis provider).
- `apps/web/src/app/[locale]` — localized routes (`signin`, `verify`, `callback`, protected `check`).
- `apps/web/src/features/auth` — client auth bootstrap + UI guard.
- `apps/web/src/shared/api` — axios client + auth/user API wrappers.
- `apps/web/src/stores/auth` — Zustand auth state.
- `apps/web/src/i18n` — locale routing and message loading.
- `packages/types/src` — shared constants/contracts/entities/validation.
- `.github/workflows/ci.yml` — lint/build + API unit test pipeline.
- `docs/audits/auth/2026-02-23/auth-implementation-audit.md` — технічний аудит auth імплементації.

## Domain Model & Schema
**Primary persistent entity (MongoDB):**
- `User` (`apps/api/src/modules/users/schemas/user.schema.ts`)
  - `email` (unique, lowercase)
  - `provider?` (name/id, OAuth link)
  - `profile` (name/avatar)
  - `credits` (`balance`, `freeReportUsed`)
  - `preferredLang` (`LANG.UK | LANG.EN`)
  - `lastLoginAt`, `createdAt`, `updatedAt`
  - index: `provider.id` sparse

**Runtime/session state (Redis):**
- `magic:{token}` -> email (TTL 15m)
- `ratelimit:magic:{email}` -> counter (TTL 15m)
- `refresh:{jti}` -> userId (TTL 7d)
- `refresh_family:{userId}` -> set of active `jti`

**Shared typed contracts (FE/BE):**
- `UserSchema`, `UserProfileSchema` (`packages/types/src/entities/user.ts`)
- `SendMagicLinkSchema`, `VerifyMagicLinkSchema`, `AuthResponseSchema` (`packages/types/src/contracts/auth.ts`)
- `ApiErrorSchema` + `ERROR_CODE` (`packages/types/src/contracts/api.ts`, `packages/types/src/enums/error-code.ts`)

## Module Dependency Map
**API graph**
- `AppModule` -> `AuthModule`, `UsersModule`, `ReportsModule`, `StorageModule`, `PaymentsModule`, `ThrottlerModule`, `MongooseModule`, `ConfigModule`.
- `AuthModule` -> `UsersModule`, `JwtModule`, `PassportModule`, `redisProvider`.
- `AuthController` -> `AuthService` -> (`UsersService`, `JwtService`, `EmailService`, `REDIS_CLIENT`).
- `JwtStrategy` -> `UsersService`.
- `UsersModule` -> `Mongoose(UserSchema)`.
- `AllExceptionsFilter` -> `@lucidkit/types` (`ERROR_CODE`).

**Web graph**
- `app/[locale]/layout.tsx` -> `Providers` + `NextIntlClientProvider` + `AuthInitializer` + `Header`.
- `AuthInitializer` -> `refreshToken()` + `getMe()` -> `shared/api/auth.ts` -> `apiClient`.
- `AuthGuard` -> `useAuthStore` + router redirect.
- `middleware.ts` -> `i18n/routing.ts` + `bid_refresh` cookie checks.
- `shared/api/*` -> `shared/config/env.ts`.

**Cross-app graph**
- `apps/api` + `apps/web` -> `@lucidkit/types` (constants, DTO contracts, error enum, user entity schemas/types).

## Key Patterns (CodeDNA)
- **Створення Endpoint:** `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/users/users.controller.ts`.
- **Валідація:** `apps/api/src/modules/auth/dto/send-magic-link.dto.ts`, `apps/api/src/modules/auth/dto/verify-magic-link.dto.ts`, `packages/types/src/contracts/auth.ts`.
- **Auth/Guard:** `apps/api/src/common/guards/jwt-auth.guard.ts`, `apps/api/src/modules/auth/strategies/jwt.strategy.ts`, `apps/web/src/features/auth/AuthGuard.tsx`, `apps/web/src/middleware.ts`.
- **Error Handling:** `apps/api/src/common/filters/all-exceptions.filter.ts`.

## API Surface
Global prefix: `/api` (`apps/api/src/main.ts`).

**AppController (`apps/api/src/app.controller.ts`)**
- `GET /api` — hello probe (`Hello World!`).
- `GET /api/health` — basic health payload (`status`, `timestamp`, `environment`).

**AuthController (`apps/api/src/modules/auth/auth.controller.ts`)**
- `GET /api/auth/google` — start Google OAuth redirect flow.
- `GET /api/auth/google/callback` — OAuth callback, issue tokens, set `bid_refresh` cookie, redirect to web callback page.
- `POST /api/auth/magic-link/send` — create magic-link token, Redis rate-limit, send email.
- `POST /api/auth/magic-link/verify` — consume token, upsert user, return `AuthResponse`, set refresh cookie.
- `POST /api/auth/refresh` — rotate refresh token (JWT + Redis token family).
- `POST /api/auth/logout` — revoke refresh token (best effort) and clear cookie.

**UsersController (`apps/api/src/modules/users/users.controller.ts`)**
- `GET /api/users/me` — protected profile endpoint (`JwtAuthGuard`), returns `UserProfile`.

**ReportsController / PaymentsController**
- Controllers є (`apps/api/src/modules/reports/reports.controller.ts`, `apps/api/src/modules/payments/payments.controller.ts`), публічних endpoint methods зараз немає.

## Environment & Config
**Fail-fast env loaders**
- API: `apps/api/src/config/env.ts`
- Web: `apps/web/src/shared/config/env.ts`

**Core runtime/env keys**
- `NODE_ENV` — logger level, secure cookies, behavior branches.
- `PORT` / `WEB_PORT` / `API_PORT` — process binding and docker port mapping.
- `WEB_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL` — redirects, canonical metadata, client API base URL.

**Data/auth keys**
- `MONGODB_URI`, `MONGODB_DB_NAME` — Mongo connection/database.
- `REDIS_URL` — Redis connection for token/rate-limit state.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — JWT signing/verification.

**Integrations**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` — Google OAuth strategy.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — magic-link email transport/sender.
- `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_URL` — Cloudflare R2 (prepared, not yet consumed by business logic).
- `GOOGLE_GEMINI_API_KEY` — reserved for AI integration (not yet consumed by modules).

## Testing Strategy
- **API Unit tests:** service-level tests with mocks for Redis/JWT/Mongoose (`apps/api/src/modules/auth/auth.service.spec.ts`, `apps/api/src/modules/users/users.service.spec.ts`).
- **API Controller unit:** simple `AppController` checks (`apps/api/src/app.controller.spec.ts`).
- **API E2E:** single smoke test bootstrapping full `AppModule` (`apps/api/test/app.e2e-spec.ts`).
- **Web tests:** відсутні (немає `*.spec.ts(x)` у `apps/web/src`).
- **CI:** `pnpm lint`, `pnpm build`, `pnpm --filter api test` (`.github/workflows/ci.yml`).

## Dev Workflow
- **Start (all):** `pnpm dev`
- **Start (api only):** `pnpm --filter api dev`
- **Start (web only):** `pnpm --filter web dev`
- **Build (all):** `pnpm build`
- **Build (api/web):** `pnpm --filter api build`, `pnpm --filter web build`
- **Test (all workspace task):** `pnpm test`
- **Test (api):** `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter api test:cov`
- **Lint:** `pnpm lint`
- **Format:** `pnpm format`
- **Docker dev stack:** `docker compose -f docker-compose.dev.yml up --build`
- **DB Migration:** відсутні migration scripts (Mongoose schema-first; manual/one-off data changes).

## Rules & Conventions
# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm/Turborepo monorepo. Primary locations:

- `apps/web/` — Next.js frontend (App Router, `src/app/[locale]/` for pages and i18n).
- `apps/api/` — NestJS backend (`src/modules/` for feature modules).
- `packages/types/` — Shared TypeScript types (`@lucidkit/types`).
- Root configs: `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.prettierrc`.

Frontend follows Feature-Sliced Design in `apps/web/src/`:

- `features/`, `entities/`, `widgets/`, `shared/ui/`, `shared/lib/`, `shared/icons/`, `stores/`.

## Build, Test, and Development Commands

Run from repo root:

- `pnpm dev` — Start all apps in dev mode via Turborepo.
- `pnpm build` — Build all apps.
- `pnpm lint` — Lint all apps.
- `pnpm format` — Format with Prettier.

API-specific testing:

- `pnpm --filter api test` — Unit tests.
- `pnpm --filter api test:watch` — Watch mode.
- `pnpm --filter api test:e2e` — End-to-end tests.
- `pnpm --filter api test:cov` — Coverage run.

Docker (optional):

- `docker compose -f docker-compose.dev.yml up --build` — Dev with local MongoDB.
- `docker compose up --build -d` — Production-style run (Atlas).

## Coding Style & Naming Conventions

- Language: TypeScript across apps and packages.
- Formatting: Prettier (`pnpm format`). ESLint runs via `pnpm lint`.
- UI components in `apps/web/src/shared/ui/` follow: `Component.tsx`, `types.ts`, `index.ts`, `README.md`.
- Keep naming consistent with existing modules (e.g., `UiButton`, `UiSelect`).

## Testing Guidelines

- Run API tests with `pnpm --filter api test` before PRs.
- Use `test:cov` for coverage-sensitive changes.
- Keep test files near related modules under `apps/api/src/`.

## Commit & Pull Request Guidelines

- Git history is not available in this workspace, so no commit convention can be inferred.
- Use concise, imperative commit summaries (e.g., `add api kv module`).
- PRs should include:
    - Clear description of behavior changes.
    - Linked issues/tickets if applicable.
    - Screenshots for UI changes (web).
    - Notes on env/config updates (e.g., `.env` keys).

## Configuration & Environment

Root `.env` should define at least:

- `WEB_PORT`, `API_PORT`, `MONGODB_URI` or `MONGODB_DB_NAME`,
- `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`.

If you add new env keys, update documentation and sample config.

## Known Complexities & Debt
- `AuthService` використовує multi-step Redis token-rotation (`refresh:*`, `refresh_family:*`) + grace period; зміни без regression tests ризиковані (`apps/api/src/modules/auth/auth.service.ts`).
- Magic-link verify робить `GET` + `DEL` окремими командами Redis; потенційний race при конкурентних запитах (`apps/api/src/modules/auth/auth.service.ts`).
- Auth gate дублюється на edge (`middleware.ts`, cookie presence) і на client (`AuthGuard`, Zustand state); при split-domain cookie setup можливі false redirects (`apps/web/src/middleware.ts`, `apps/web/src/features/auth/AuthGuard.tsx`).
- Callback path і глобальний `AuthInitializer` обидва викликають refresh/getMe; можливі зайві refresh rotation cycles (`apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/auth/callback/page.tsx`).
- `ReportsModule`, `PaymentsModule`, `StorageModule` наразі каркасні (без endpoint/business flow) — подальша роль модулів неочевидна з коду `[NEED_CONTEXT]`.
- E2E тест піднімає full `AppModule` (реальні зовнішні залежності: Mongo/Redis/env), що робить запуск чутливим до середовища (`apps/api/test/app.e2e-spec.ts`).
