# LucidKit
> Monorepo-monolith на Next.js 16 + NestJS 11, де auth/session lifecycle централізований у API, а FE/BE працюють через shared Zod/TypeScript contracts.

## Tech Stack
- **Core:** TypeScript 5.9, Node.js 20 (CI/Docker), Next.js 16.0.1 + React 19.2 (`apps/web`), NestJS 11.1.x (`apps/api`).
- **Data:** MongoDB (Mongoose 8, schema-first), Redis 7 + ioredis 5 для refresh/magic-link/rate-limit state.
- **Infra:** pnpm workspaces + Turborepo, Docker Compose (`docker-compose.yml`, `docker-compose.dev.yml`), GitHub Actions (`.github/workflows/ci.yml`).
- **Libs:** `nestjs-zod` + `zod`, `passport-jwt`, `passport-google-oauth20`, `@nestjs/throttler`, `@nestjs/schedule`, `axios`, `zustand`, `next-intl`, `next-themes`, `sonner`, `@headlessui/react`.

## Architecture Overview
Monorepo-monolith із трьома основними зонами: `apps/api`, `apps/web`, `packages/types`.

- **API:** NestJS module graph (`AppModule` -> `AuthModule`, `UsersModule`, scaffold `Reports/Payments/Storage`), global `/api` prefix, global `ZodValidationPipe`, global `AllExceptionsFilter`, global `ThrottlerGuard`.
- **Auth model:** access JWT (1h) у пам’яті фронта + refresh JWT (7d) у httpOnly cookie `bid_refresh`; Redis token family (`refresh:*`, `refresh_family:*`) з rotation/reuse-detection через `GETDEL`.
- **Web:** App Router + locale segment routing (`app/[locale]`), edge middleware з cookie gate, client bootstrap через `AuthInitializer`, route guard через `AuthGuard`.
- **FE/BE sync:** DTO/contracts/enums з `@lucidkit/types` використовуються і в Nest DTO (`createZodDto`), і у web API wrappers.

## Project Structure
- `apps/api/src/main.ts` — API bootstrap (prefix/cors/cookie-parser/global pipes & filters).
- `apps/api/src/app.module.ts` — composition root (Config, Mongoose, Throttler, Schedule, feature modules).
- `apps/api/src/config/env.ts` — fail-fast env loader + auth/rate-limit tuning.
- `apps/api/src/common` — Redis provider, JWT guard, `CurrentUser`, global exception filter.
- `apps/api/src/modules/auth` — password auth, magic-link, Google OAuth, refresh rotation, email templates.
- `apps/api/src/modules/users` — profile/lang/password-adjacent user ops, soft-delete/restore, cleanup cron.
- `apps/web/src/app/[locale]` — localized routes (`/`, `/auth/*`, protected profile).
- `apps/web/src/features/auth` — `AuthInitializer`, `AuthGuard`.
- `apps/web/src/features/profile` — profile edit, password flows, account deletion UX.
- `apps/web/src/shared/api` — axios client/interceptors + auth/users API wrappers + API-code mapping.
- `apps/web/src/stores/auth` — Zustand auth state (`user`, `isAuthenticated`, `isLoading`).
- `apps/web/src/i18n` + `apps/web/messages/*.json` — locale routing, dictionaries, runtime messages.
- `packages/types/src` — shared constants/enums/contracts/entities/validation.
- `docs/conventions` — mandatory agent rules (tone/fail-fast/i18n sync).

## Domain Model & Schema
**MongoDB (primary persistent model):**
- `User` (`apps/api/src/modules/users/schemas/user.schema.ts`)
  - `email` (unique, normalized lower-case)
  - `provider?: { name, id }` (OAuth linkage)
  - `profile: { name?, avatar? }`
  - `credits: { balance, freeReportUsed }`
  - `passwordHash: string | null`
  - `deletedAt: Date | null` (soft-delete)
  - `preferredLang` (`uk`/`en`), `lastLoginAt`, timestamps
  - sparse index: `provider.id`

**Redis (runtime/session state):**
- `refresh:{jti}` -> `userId` or short-lived `rotated` marker
- `refresh_family:{userId}` -> active JTI set
- `magic:{token}` -> JSON `{ email, purpose }`
- `magic_dedup:{email}:{purpose}` -> anti-spam dedup
- `ratelimit:magic:{email}` -> per-email magic-link rate counter
- `check_email:{ip}` -> check-email rate limit
- `login_attempts:{ip}:{email}` -> progressive brute-force lockout

**Shared contracts (`@lucidkit/types`):**
- Auth schemas: `CheckEmailSchema`, `LoginPasswordSchema`, `SendMagicLinkSchema`, `VerifyMagicLinkSchema`, `SetPasswordSchema`, `ChangePasswordSchema`, `VerifyPasswordSchema`.
- User schemas: `UpdateProfileSchema`, `UpdateLangSchema`, `UserProfileSchema`.
- Enums/constants: `RESPONSE_CODE`, `RESPONSE_CODE_TYPE`, `ERROR_CODE` (compat), `LANG`, `MAGIC_LINK_PURPOSE`.

## Module Dependency Map
**API graph**
- `AppModule` -> `AuthModule`, `UsersModule`, `ReportsModule`, `PaymentsModule`, `StorageModule`, infra modules.
- `AuthModule` <-> `UsersModule` через `forwardRef`.
- `AuthController` -> `AuthService` -> (`UsersService`, `JwtService`, `EmailService`, `REDIS_CLIENT`).
- `UsersController` -> (`UsersService`, `AuthService`) для profile/lang/delete/restore.
- `CleanupService` -> (`UserModel`, `AuthService`) для grace-period hard delete + revoke.
- `JwtStrategy` -> `UsersService` (reject `deletedAt` users).

**Web graph**
- `app/[locale]/layout.tsx` -> `Providers` + `NextIntlClientProvider` + `AuthInitializer` + `Header`.
- `middleware.ts` -> `i18n/routing.ts` + `bid_refresh` presence checks.
- `auth/signin/page.tsx` -> `checkEmail` -> (`loginWithPassword` | `sendMagicLink`) -> `getMe`.
- `auth/verify/page.tsx` -> `verifyMagicLink` -> `getMe` + purpose-based redirects.
- `auth/callback/page.tsx` -> `refreshToken` -> `getMe`.
- `shared/api/client.ts` -> axios interceptors -> refresh dedup (`refreshPromise`) + retry original request.

**Cross-app graph**
- `apps/api` + `apps/web` -> `@lucidkit/types`.

## Key Patterns (CodeDNA)
- **Створення Endpoint:** `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/users/users.controller.ts`.
- **Валідація:** `apps/api/src/modules/*/dto/*.ts` + `packages/types/src/contracts/*.ts` (`createZodDto`).
- **Auth/Guard:** `apps/api/src/modules/auth/strategies/jwt.strategy.ts`, `apps/api/src/common/guards/jwt-auth.guard.ts`, `apps/web/src/features/auth/AuthGuard.tsx`, `apps/web/src/middleware.ts`.
- **Error Handling:** `apps/api/src/common/filters/all-exceptions.filter.ts`.

## API Surface
Global prefix: `/api`.

**AppController** (`apps/api/src/app.controller.ts`)
- `GET /api` — hello probe.
- `GET /api/health` — status/timestamp/environment.

**AuthController** (`apps/api/src/modules/auth/auth.controller.ts`)
- `GET /api/auth/google` — start Google OAuth.
- `GET /api/auth/google/callback` — OAuth callback, set refresh cookie, redirect to web callback.
- `POST /api/auth/check-email` — detect user existence + `hasPassword`.
- `POST /api/auth/login/password` — password login + token pair.
- `POST /api/auth/magic-link/send` — magic-link issue with rate-limit/dedup.
- `POST /api/auth/magic-link/verify` — consume token; login/register/reset/delete-account branches.
- `POST /api/auth/password/set` — set first password (JWT).
- `POST /api/auth/password/change` — verify current password, revoke sessions, issue new pair.
- `POST /api/auth/password/delete` — clear password hash.
- `POST /api/auth/password/verify` — verify password for sensitive actions.
- `POST /api/auth/refresh` — refresh rotation.
- `POST /api/auth/logout` — revoke refresh token best-effort + clear cookie.

**UsersController** (`apps/api/src/modules/users/users.controller.ts`)
- `GET /api/users/me` — current profile.
- `PATCH /api/users/me` — update profile + optional preferred language.
- `PATCH /api/users/me/lang` — language update only.
- `POST /api/users/account/delete` — choose delete path (`requiresPassword` vs `requiresMagicLink`).
- `POST /api/users/account/delete/confirm` — password-confirmed soft delete + token revoke.
- `POST /api/users/account/restore` — restore soft-deleted account (JWT protected).

**Reports/Payments**
- Controllers exist (`/api/reports`, `/api/payments`), route methods not implemented.

## Environment & Config
**Fail-fast loaders**
- API: `apps/api/src/config/env.ts`.
- Web: `apps/web/src/shared/config/env.ts`.

**Critical API env keys**
- Runtime: `NODE_ENV`, `PORT`, `WEB_URL`.
- Data/Auth: `MONGODB_URI`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
- OAuth/Email: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- Auth tuning: `AUTH_PASSWORD_MIN_LENGTH`, `AUTH_LOCKOUT_THRESHOLDS`, `AUTH_LOGIN_ATTEMPTS_TTL_MIN`, `AUTH_MAGIC_LINK_TTL_MIN`, `AUTH_MAGIC_LINK_RATE_LIMIT`, `AUTH_MAGIC_LINK_RATE_WINDOW_MIN`, `AUTH_MAGIC_LINK_DEDUP_SEC`, `ACCOUNT_DELETION_GRACE_DAYS`.

**Critical Web/infra env keys**
- Public: `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`.
- Internal reverse proxy: `API_INTERNAL_URL` (read in `apps/web/next.config.ts`).
- Compose ports: `WEB_PORT`, `API_PORT`.

## Dev Workflow
- **Start all:** `pnpm dev`
- **Start app:** `pnpm --filter api dev`, `pnpm --filter web dev`
- **Build:** `pnpm build`, `pnpm --filter api build`, `pnpm --filter web build`
- **Lint/Format:** `pnpm lint`, `pnpm format`
- **Tests:** `pnpm test`, `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter api test:cov`, `pnpm --filter web test`
- **Docker dev:** `docker compose -f docker-compose.dev.yml up --build`
- **Docker prod-like:** `docker compose up --build -d`
- **DB migration:** відсутні (Mongoose schema-first).

## Known Complexities & Debt
- `JwtStrategy` відхиляє `deletedAt` users, тому `POST /api/users/account/restore` недосяжний для soft-deleted сесій (`apps/api/src/modules/auth/strategies/jwt.strategy.ts`, `apps/api/test/auth.e2e-spec.ts`).
- Подвійний auth bootstrap: `AuthInitializer` і `/auth/callback` обидва виконують refresh/getMe, що провокує зайві refresh rotations (`apps/web/src/features/auth/AuthInitializer.tsx`, `apps/web/src/app/[locale]/auth/callback/page.tsx`).
- Edge gate у `middleware.ts` перевіряє лише наявність `bid_refresh`, не валідність; stale cookie може давати хибні редіректи.
- `sendMagicLink` на фронті передає `lang`, але backend у `AuthService.sendMagicLink` обирає мову з `user.preferredLang` або `uk`; для new email параметр `lang` ігнорується.
- `getApiMessageKey` повертає `errors.generic.<unknown_code>`, але словники мають лише `errors.generic.unknown`; ризик missing translation (`apps/web/src/shared/api/mapApiCode.ts`, `apps/web/messages/*.json`).
- `apps/web/next.config.ts` має fallback `API_INTERNAL_URL || 'http://localhost:4000'`, що суперечить fail-fast policy.
- `AppController.getHealth()` повертає `process.env.NODE_ENV || 'development'` замість централізованого `ENV` (`apps/api/src/app.controller.ts`).
- `ReportsModule`, `PaymentsModule`, `StorageModule` лишаються scaffold без бізнес-flow `[NEED_CONTEXT]`.
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
