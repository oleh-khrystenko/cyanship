# LucidKit
> Monorepo-моноліт із Next.js 16 (App Router) і NestJS 11, де auth/session state зосереджений в API, а FE/BE синхронізовані через shared TypeScript/Zod contracts.

## Tech Stack
- **Core:** TypeScript 5.9, Node.js 20 (CI/Docker), Next.js 16.0.1 + React 19.2 (`apps/web`), NestJS 11.1 (`apps/api`).
- **Data:** MongoDB 7 + Mongoose 8 (`apps/api/src/modules/users/schemas/user.schema.ts`), Redis 7 + ioredis 5 для token/rate-limit state.
- **Infra:** pnpm workspaces + Turborepo, Docker Compose (`docker-compose.yml`, `docker-compose.dev.yml`), GitHub Actions CI (`.github/workflows/ci.yml`).
- **Libs:** `next-intl`, `next-themes`, `zustand`, `axios`, `nestjs-zod` + `zod`, `passport-google-oauth20`, `passport-jwt`, `bcrypt`, `resend`, `@nestjs/schedule`, `@nestjs/throttler`.

## Architecture Overview
Monorepo-monolith з трьома шарами: `apps/api` (NestJS API), `apps/web` (Next.js App Router UI), `packages/types` (shared contracts/DTO schemas/enums).

- **API layer:** `main.ts` конфігурує global prefix `/api`, `cookie-parser`, CORS, `ZodValidationPipe`, `AllExceptionsFilter`. `AppModule` піднімає `AuthModule`, `UsersModule`, плюс scaffold-модулі `Reports`, `Payments`, `Storage`.
- **Auth model:** password login + magic link + Google OAuth. JWT access (1h) у memory на frontend; refresh (7d) у httpOnly cookie `bid_refresh` + Redis token family (`refresh:*`, `refresh_family:*`) з rotation/reuse detection.
- **User lifecycle:** soft-delete через `deletedAt`, restore endpoint, cron hard-delete (`CleanupService`) після grace period.
- **Web layer:** locale-segment routing `app/[locale]`, edge middleware (`middleware.ts`) для cookie-based redirects, client bootstrap (`AuthInitializer`) для refresh/getMe, protected UI через `AuthGuard`.
- **Same-origin auth cookies:** `apps/web/next.config.ts` rewrites `/api/*` -> `API_INTERNAL_URL`, щоб refresh cookie ставився на web-origin і читався middleware.

## Project Structure
- `apps/api/src/main.ts` — bootstrap API (prefix/CORS/global pipes + filters).
- `apps/api/src/app.module.ts` — composition root (Config, Mongoose, Throttler, Schedule, feature modules).
- `apps/api/src/modules/auth` — OAuth, magic-link, password auth, refresh rotation, email transport.
- `apps/api/src/modules/users` — user profile/lang/password-adjacent operations + account deletion/restore + cleanup cron.
- `apps/api/src/common` — `JwtAuthGuard`, `CurrentUser`, Redis provider, global exception filter.
- `apps/api/src/config/env.ts` — fail-fast env parsing + auth tuning params.
- `apps/web/src/app/[locale]` — localized routes (`/`, `/auth/*`, protected `/profile`).
- `apps/web/src/features/auth` — app bootstrap (`AuthInitializer`) + UI guard.
- `apps/web/src/features/profile` — profile update, password actions, account deletion UX.
- `apps/web/src/shared/api` — axios client, auth/user API wrappers, API-code->i18n key mapping.
- `apps/web/src/stores/auth` — Zustand auth state (`user`, `isAuthenticated`, `isLoading`).
- `apps/web/src/i18n` + `apps/web/messages/*.json` — locale routing + dictionaries.
- `packages/types/src` — shared constants, enums, contracts, entities, zod validation.
- `docs/conventions/*` — global project conventions (tone/fail-fast/i18n).

## Domain Model & Schema
**Primary persistent entity (MongoDB):**
- `User` (`apps/api/src/modules/users/schemas/user.schema.ts`)
  - `email` (unique, lowercase)
  - `provider?` (`name`, `id`) для OAuth linkage
  - `profile` (`name`, `avatar`)
  - `credits` (`balance`, `freeReportUsed`)
  - `passwordHash` (`string | null`)
  - `deletedAt` (`Date | null`) для soft delete
  - `preferredLang` (`uk`/`en`), `lastLoginAt`, timestamps
  - index: `provider.id` sparse

**Runtime/session state (Redis):**
- `refresh:{jti}` -> `userId` (TTL 7d) + short `rotated` marker for grace period
- `refresh_family:{userId}` -> set of active JTIs
- `magic:{token}` -> JSON `{ email, purpose }` (TTL configurable)
- `magic_dedup:{email}:{purpose}` -> anti-spam dedup window
- `ratelimit:magic:{email}` -> magic-link rate limit counter
- `check_email:{ip}` -> email-check throttling
- `login_attempts:{ip}:{email}` -> progressive brute-force control

**Shared contracts (`@lucidkit/types`):**
- `SendMagicLinkSchema`, `VerifyMagicLinkSchema`, `LoginPasswordSchema`, `SetPasswordSchema`, `ChangePasswordSchema`, `VerifyPasswordSchema`
- `AuthResponseSchema`, `CheckEmailResponseSchema`, `UpdateProfileSchema`, `UpdateLangSchema`
- `RESPONSE_CODE`/`RESPONSE_CODE_TYPE`, `ERROR_CODE`, `LANG`, `MAGIC_LINK_PURPOSE`

## Module Dependency Map
**API graph**
- `AppModule` -> `AuthModule`, `UsersModule`, `ReportsModule`, `StorageModule`, `PaymentsModule`, `ThrottlerModule`, `ScheduleModule`, `MongooseModule`.
- `AuthModule` <-> `UsersModule` (взаємна залежність через `forwardRef`).
- `AuthController` -> `AuthService` -> (`UsersService`, `JwtService`, `EmailService`, `REDIS_CLIENT`).
- `UsersController` -> (`UsersService`, `AuthService`) для profile/lang/delete/restore flow.
- `CleanupService` -> (`UserModel`, `AuthService`) для revoke tokens + hard delete.
- `JwtStrategy` -> `UsersService` (reject deleted users).

**Web graph**
- `app/[locale]/layout.tsx` -> `Providers` + `NextIntlClientProvider` + `AuthInitializer` + `Header`.
- `middleware.ts` -> `i18n/routing.ts` + `bid_refresh` cookie gate.
- `signin/page.tsx` -> `checkEmail` -> (`loginWithPassword` | `sendMagicLink`) -> `getMe` -> `authStore`.
- `verify/page.tsx` -> `verifyMagicLink` -> purpose-based redirect.
- `callback/page.tsx` -> `refreshToken` + `getMe` після OAuth redirect.
- `shared/api/client.ts` -> axios interceptors -> `/auth/refresh` dedup + retry original request.

**Cross-app graph**
- `apps/api` + `apps/web` -> `@lucidkit/types` (DTO schemas, enums, entity schemas, constants).

## Key Patterns (CodeDNA)
- **Створення Endpoint:** `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/users/users.controller.ts`.
- **Валідація:** `apps/api/src/modules/auth/dto/*.ts`, `apps/api/src/modules/users/dto/*.ts`, `packages/types/src/contracts/*.ts` (`createZodDto` + Zod).
- **Auth/Guard:** `apps/api/src/common/guards/jwt-auth.guard.ts`, `apps/api/src/modules/auth/strategies/jwt.strategy.ts`, `apps/web/src/features/auth/AuthGuard.tsx`, `apps/web/src/middleware.ts`.
- **Error Handling:** `apps/api/src/common/filters/all-exceptions.filter.ts` (HTTP status -> `ERROR_CODE` mapping).

## API Surface
Global prefix: `/api`.

**AppController** (`apps/api/src/app.controller.ts`)
- `GET /api` — hello probe.
- `GET /api/health` — status/timestamp/environment.

**AuthController** (`apps/api/src/modules/auth/auth.controller.ts`)
- `GET /api/auth/google` — start Google OAuth.
- `GET /api/auth/google/callback` — OAuth callback, issue tokens, set `bid_refresh`, redirect to web callback.
- `POST /api/auth/check-email` — probe user existence + password availability.
- `POST /api/auth/login/password` — password login, set refresh cookie, return `AuthResponse` (+ optional `accountDeleted`).
- `POST /api/auth/magic-link/send` — issue magic-link token with per-email rate-limit + dedup.
- `POST /api/auth/magic-link/verify` — consume token, login/register/reset/delete-account flow.
- `POST /api/auth/password/set` — set initial password (JWT protected).
- `POST /api/auth/password/change` — rotate password + revoke sessions + new token pair.
- `POST /api/auth/password/delete` — remove password hash.
- `POST /api/auth/password/verify` — check password validity for sensitive actions.
- `POST /api/auth/refresh` — rotate refresh token and return new access token.
- `POST /api/auth/logout` — best-effort refresh revoke + clear cookie.

**UsersController** (`apps/api/src/modules/users/users.controller.ts`)
- `GET /api/users/me` — current user profile.
- `PATCH /api/users/me` — update `profile` and optional `preferredLang`.
- `PATCH /api/users/me/lang` — update preferred language only.
- `POST /api/users/account/delete` — choose delete path (`requiresPassword` vs magic-link).
- `POST /api/users/account/delete/confirm` — password-confirmed soft delete + token revoke + cookie clear.
- `POST /api/users/account/restore` — restore soft-deleted account.

**Reports / Payments**
- `ReportsController`, `PaymentsController` exist, but no route methods yet.

## Environment & Config
**Fail-fast env loaders**
- API: `apps/api/src/config/env.ts` (hard fail for critical envs, optional defaults only for explicitly allowed keys).
- Web: `apps/web/src/shared/config/env.ts` (`NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL` required).

**Critical API env groups**
- Runtime: `NODE_ENV`, `PORT`, `WEB_URL`.
- Data/Auth: `MONGODB_URI`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
- OAuth/Email: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- Auth tuning: `AUTH_PASSWORD_MIN_LENGTH`, `AUTH_LOCKOUT_THRESHOLDS`, `AUTH_LOGIN_ATTEMPTS_TTL_MIN`, `AUTH_MAGIC_LINK_TTL_MIN`, `AUTH_MAGIC_LINK_RATE_LIMIT`, `AUTH_MAGIC_LINK_RATE_WINDOW_MIN`, `AUTH_MAGIC_LINK_DEDUP_SEC`, `ACCOUNT_DELETION_GRACE_DAYS`.

**Critical Web/infra env groups**
- Public: `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`.
- Internal proxy: `API_INTERNAL_URL` (in `next.config.ts`, has localhost fallback).
- Compose orchestration: `WEB_PORT`, `API_PORT`.

## Testing Strategy
- **API unit/controller tests:** auth/users/app modules with mocked Redis/JWT/Mongoose/email (`apps/api/src/**/*.spec.ts`).
- **API e2e:**
  - `apps/api/test/app.e2e-spec.ts` (smoke + basic auth/user guards).
  - `apps/api/test/auth.e2e-spec.ts` (full password/magic-link/delete/refresh/user-profile lifecycle with MongoMemoryServer + stateful Redis mock).
- **Web unit tests:** middleware, auth features, auth store, shared API client/wrappers (`apps/web/src/**/*.spec.ts(x)`).
- **CI currently runs:** `pnpm lint`, `pnpm build`, `pnpm --filter api test` (web tests + api e2e не запускаються в CI).

## Dev Workflow
- **Start (all):** `pnpm dev`
- **Start (api/web):** `pnpm --filter api dev`, `pnpm --filter web dev`
- **Build:** `pnpm build`, або `pnpm --filter api build`, `pnpm --filter web build`
- **Tests:** `pnpm test`, `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter api test:cov`, `pnpm --filter web test`
- **Lint/Format:** `pnpm lint`, `pnpm format`
- **Docker dev:** `docker compose -f docker-compose.dev.yml up --build`
- **Docker prod-like:** `docker compose up --build -d`
- **DB migration:** відсутні (Mongoose schema-first, без migration tooling).

## Known Complexities & Debt
- `JwtStrategy` відхиляє `deletedAt` users, тому `POST /api/users/account/restore` фактично недоступний для soft-deleted сесій (див. `apps/api/src/modules/auth/strategies/jwt.strategy.ts`, `apps/api/test/auth.e2e-spec.ts`).
- Auth bootstrap дублюється: `AuthInitializer` і `/auth/callback` обидва роблять refresh/getMe, що додає зайві refresh rotations.
- Edge gate в `middleware.ts` перевіряє лише наявність `bid_refresh` cookie, не валідність; можливі redirect-помилки зі stale cookie.
- `sendMagicLink` API приймає `lang`, але backend реально вибирає мову з user profile (`preferredLang`) або default `uk`; для нового email переданий `lang` ігнорується.
- `getApiMessageKey` повертає ключі виду `errors.generic.<unknown_code>`, але словники мають лише `errors.generic.unknown`; є ризик missing translation для невідомих кодів.
- `next.config.ts` має fallback `API_INTERNAL_URL || http://localhost:4000`, що суперечить fail-fast підходу для env config.
- `ReportsModule`, `PaymentsModule`, `StorageModule` залишаються scaffold без бізнес-flow `[NEED_CONTEXT]`.



<!-- MANUAL:START -->
# Rules

- Before making ANY code changes, read the relevant module's files to understand current implementation
- Always check prisma/schema.prisma before modifying data layer
- Always check existing patterns in similar modules before creating new ones

## Project Conventions (MANDATORY)

All AI agents MUST read and follow rules in `docs/conventions/`:

- **[Tone & Style](docs/conventions/tone.md)** — tone and style for all user-facing messages (toasts, errors, confirmations)
- **[Fail Fast](docs/conventions/fail-fast.md)** — required env vars policy, no silent fallbacks

Full index: [docs/conventions/README.md](docs/conventions/README.md)
  <!-- MANUAL:END -->

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

- `WEB_PORT`, `API_PORT`, `MONGODB_URI`,
- `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`.

If you add new env keys, update documentation and sample config.

## Known Complexities & Debt
- `AuthService` використовує multi-step Redis token-rotation (`refresh:*`, `refresh_family:*`) + grace period; зміни без regression tests ризиковані (`apps/api/src/modules/auth/auth.service.ts`).
- Magic-link verify робить `GET` + `DEL` окремими командами Redis; потенційний race при конкурентних запитах (`apps/api/src/modules/auth/auth.service.ts`).
- Auth gate дублюється на edge (`middleware.ts`, cookie presence) і на client (`AuthGuard`, Zustand state); при split-domain cookie setup можливі false redirects (`apps/web/src/middleware.ts`, `apps/web/src/features/auth/AuthGuard.tsx`).
- Callback path і глобальний `AuthInitializer` обидва викликають refresh/getMe; можливі зайві refresh rotation cycles (`apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/auth/callback/page.tsx`).
- `ReportsModule`, `PaymentsModule`, `StorageModule` наразі каркасні (без endpoint/business flow) — подальша роль модулів неочевидна з коду `[NEED_CONTEXT]`.
- E2E тест піднімає full `AppModule` (реальні зовнішні залежності: Mongo/Redis/env), що робить запуск чутливим до середовища (`apps/api/test/app.e2e-spec.ts`).
