# CyanShip

> Monorepo-monolith on Next.js 16 + NestJS 11 where API owns auth/session lifecycle, billing, and shared Zod/TypeScript contracts for both apps.

## Tech Stack

| Layer | Technology | Version / Role |
|---|---|---|
| Core | TypeScript, Node.js | TS 5.9, Node 20 |
| Frontend | Next.js, React, next-intl, Zustand, Tailwind CSS | Next 16.0.1, React 19.2 |
| Backend | NestJS, nestjs-zod, Passport | NestJS 11.1.x, Zod DTO pipeline, JWT + Google OAuth |
| Data | MongoDB, Mongoose, Redis, ioredis | Mongoose 8 schema-first, Redis session/runtime state |
| Payments | Stripe | Checkout, portal, webhook ingestion |
| Infra / Tests | pnpm workspaces, Turborepo, Docker Compose, Jest | Monorepo orchestration, unit + e2e coverage |

## Architecture Overview

CyanShip is a modular monolith with three main zones: `apps/api`, `apps/web`, and `packages/types`. The API is the system of record for auth, refresh rotation, account lifecycle, billing state, and webhook processing; the web app stays thin and talks to it through shared contracts. The frontend uses App Router with locale segments, an edge cookie gate, and a client auth bootstrap that resolves the current session into a Zustand store. Core and agency scopes are intentionally separated: the current agency implementation lives mostly in web route groups/widgets, while `apps/api/src/modules/agency` remains a placeholder and modular-boundary rules are documented in `docs/conventions/modular-boundaries.md`.

## Project Structure

```text
apps/
├── api/src/
│   ├── main.ts, app.module.ts
│   ├── config/          # env loader
│   ├── common/          # decorators, filters, guards, providers
│   └── modules/         # auth, users, payments, reports, storage, agency
├── web/src/
│   ├── app/[locale]/    # (agency), (protected), auth
│   ├── features/        # auth, profile, agency, change-lang, change-theme
│   ├── widgets/         # header, agency/landing
│   ├── shared/          # api, config, ui, seo, styles, icons
│   ├── stores/          # auth, headerNav
│   └── i18n/            # routing, request config
packages/
└── types/src/           # contracts, entities, enums, constants, validation, agency
docs/
├── architecture/        # auth-flow, payments-flow
└── conventions/         # source-of-truth rules
```

## Domain Model & Schema

### User
Файл: `apps/api/src/modules/users/schemas/user.schema.ts` | Zod: `packages/types/src/entities/user.ts`
- Soft-delete via `deletedAt` plus a separate `accountDeletionRequestedAt` marker.
- Embedded `billing` subdocument stores provider IDs, subscription state, and `lastProviderEventAt` for webhook ordering.
- Sparse indexes exist on `provider.id`, `billing.providerCustomerId`, and `billing.providerSubscriptionId`.

### ProcessedWebhookEvent
Файл: `apps/api/src/modules/payments/schemas/processed-webhook-event.schema.ts`
- Unique `(provider, providerEventId)` idempotency ledger for Stripe webhooks.
- `status` transitions `pending -> applied`; failed handlers roll back pending rows.
- Persists `occurredAt`, `userId`, and `packCode` to support replay-safe billing updates.

### Auth Runtime State
Файл: `apps/api/src/modules/auth/auth.service.ts`
- Refresh tokens live in Redis as `refresh:{jti}` plus `refresh_family:{userId}` with `GETDEL` rotation and a short `rotated` grace marker.
- Magic-link send/verify also relies on Redis for token storage, dedup, and per-email rate limiting.
- Brute-force protection is runtime-only (`login_attempts:{ip}:{email}` and `check_email:{ip}`), not persisted in MongoDB.

### Shared Contracts
Файли: `packages/types/src/contracts/auth.ts`, `packages/types/src/contracts/users.ts`, `packages/types/src/contracts/payments.ts`
- API DTOs, billing enums, and user profile shapes are defined once in Zod and reused by Nest DTO wrappers and web API clients.
- `UserBillingSchema` is shared into the web profile/billing UI, so payment-model changes affect both apps immediately.
- Agency-specific shared types are intended to stay behind `@cyanship/types/agency` per `docs/conventions/modular-boundaries.md`.

## Module Dependency Map

- `AppModule` → `AuthModule`, `UsersModule`, `PaymentsModule`, `ReportsModule`, `StorageModule`
- `AuthModule` ↔ `UsersModule` (`forwardRef`, circular)
- `PaymentsModule` → `UsersModule` + `PAYMENT_PROVIDER` abstraction (`StripeService` implementation)
- `CleanupService` → `AuthService` + `UserModel`
- `app/[locale]/layout.tsx` → `Providers` + `NextIntlClientProvider` + `AuthInitializer` + `Header`
- Protected web routes → `AuthGuard` → auth store → `shared/api/auth.ts`
- `shared/api/client.ts` → axios interceptors → refresh dedupe → `authStore`
- Agency web routes/features/widgets → core `shared/*` only; core must not import agency scope

## Key Patterns (CodeDNA)

### Створення endpoint
Nest controllers pair guard + DTO + service and return `{ data: ... }` envelopes. Приклади: `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/payments/payments.controller.ts`.

### Валідація
Zod contracts live in `packages/types/src/contracts/*`, then Nest DTOs wrap them through `createZodDto()`. Приклади: `apps/api/src/modules/auth/dto/*.ts`, `apps/api/src/modules/payments/dto/create-checkout-session.dto.ts`.

### Auth/session lifecycle
Access JWT stays in memory on the web, refresh JWT stays in `bid_refresh` httpOnly cookie, Redis tracks refresh token families, and axios deduplicates refresh calls. Файли: `apps/api/src/modules/auth/auth.service.ts`, `apps/web/src/shared/api/client.ts`, `apps/web/src/features/auth/AuthInitializer.tsx`, `apps/web/src/middleware.ts`. Full flow docs: `docs/architecture/auth-flow/README.md`.

### Billing/webhook processing
Payments go through a provider interface, Stripe webhooks require Nest `rawBody`, and MongoDB stores processed-event idempotency state before applying billing changes. Файли: `apps/api/src/modules/payments/payments.service.ts`, `apps/api/src/modules/payments/providers/stripe.service.ts`, `apps/api/src/modules/payments/schemas/processed-webhook-event.schema.ts`. Full flow docs: `docs/architecture/payments-flow/README.md`.

### Error handling and i18n mapping
API returns machine-readable codes through `AllExceptionsFilter`; the web maps those codes to locale keys instead of rendering backend strings. Файли: `apps/api/src/common/filters/all-exceptions.filter.ts`, `apps/web/src/shared/api/mapApiCode.ts`, `docs/conventions/i18n.md`.

## API Overview

Global prefix: `/api`.

**AppController** (`apps/api/src/app.controller.ts`)
- `GET /api` — public — hello probe
- `GET /api/health` — public — health snapshot

**AuthController** (`apps/api/src/modules/auth/auth.controller.ts`)
- `GET /api/auth/google` — public — start Google OAuth
- `GET /api/auth/google/callback` — Google guard — set refresh cookie and redirect to web callback
- `POST /api/auth/check-email` — public — detect account existence and password availability
- `POST /api/auth/login/password` — public — password login + token pair
- `POST /api/auth/magic-link/send` — public — issue magic-link email
- `POST /api/auth/magic-link/verify` — public — consume magic-link token
- `POST /api/auth/password/set` — `JwtActiveGuard` — set initial password
- `POST /api/auth/password/change` — `JwtActiveGuard` — rotate credentials and sessions
- `POST /api/auth/password/verify` — `JwtActiveGuard` — verify password for sensitive actions
- `POST /api/auth/refresh` — cookie-based — rotate refresh token
- `POST /api/auth/logout` — cookie-based — revoke refresh token best-effort

**UsersController** (`apps/api/src/modules/users/users.controller.ts`)
- `GET /api/users/me` — `JwtActiveGuard` — current profile + billing snapshot
- `PATCH /api/users/me` — `JwtActiveGuard` — update profile fields
- `PATCH /api/users/me/lang` — `JwtActiveGuard` — change preferred language
- `POST /api/users/account/delete` — `JwtActiveGuard` — choose password vs magic-link deletion path
- `POST /api/users/account/delete/confirm` — `JwtActiveGuard` — password-confirmed soft delete
- `POST /api/users/account/restore` — `JwtAuthGuard` — restore soft-deleted account

**PaymentsController** (`apps/api/src/modules/payments/payments.controller.ts`)
- `POST /api/payments/checkout-session` — `JwtActiveGuard` — create Stripe checkout session
- `POST /api/payments/portal-session` — `JwtActiveGuard` — create Stripe billing portal session
- `POST /api/payments/webhook/:provider` — public + `SkipThrottle` — ingest provider webhook with raw body

**Reports / Storage**
- `ReportsController` exists but exposes no route methods yet: `apps/api/src/modules/reports/reports.controller.ts`
- `StorageModule` has no controller/business flow yet: `apps/api/src/modules/storage/`

## Configuration & Environment

**Loaders and source files**
- API fail-fast loader: `apps/api/src/config/env.ts`
- Web fail-fast loader: `apps/web/src/shared/config/env.ts`
- Shared env documentation: `.env.example`
- Next reverse proxy config: `apps/web/next.config.ts`

**API env: required with defaults**
- `NODE_ENV`, `PORT`, `WEB_URL`

**API env: required without fallback**
- Data/runtime: `MONGODB_URI`, `REDIS_URL`
- Auth: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- OAuth/email: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `RESEND_API_KEY`
- Payments: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY_USD`

**API env: conditionally required / optional defaults**
- One-off Stripe prices are required only when `PAYMENTS_ONE_OFF_ENABLED=true`: `STRIPE_PRICE_CREDITS_5_USD`, `STRIPE_PRICE_CREDITS_10_USD`, `STRIPE_PRICE_CREDITS_20_USD`
- Dev-only fallback exists for `RESEND_FROM_EMAIL`; production must provide a verified sender
- `BILLING_SUCCESS_URL` and `BILLING_CANCEL_URL` default from `WEB_URL`
- Auth tuning defaults live in `apps/api/src/config/env.ts`: `AUTH_PASSWORD_MIN_LENGTH`, `AUTH_LOCKOUT_THRESHOLDS`, `AUTH_LOGIN_ATTEMPTS_TTL_MIN`, `AUTH_MAGIC_LINK_TTL_MIN`, `AUTH_MAGIC_LINK_RATE_LIMIT`, `AUTH_MAGIC_LINK_RATE_WINDOW_MIN`, `AUTH_MAGIC_LINK_DEDUP_SEC`, `ACCOUNT_DELETION_GRACE_DAYS`
- Payment feature flags default to enabled: `PAYMENTS_SUBSCRIPTION_ENABLED`, `PAYMENTS_ONE_OFF_ENABLED`

**Web env**
- Required: `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`
- Optional with defaults in client config: `NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED`, `NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED`
- Server-side reverse proxy target: `API_INTERNAL_URL`

**Infra / orchestration**
- Compose ports: `WEB_PORT`, `API_PORT`
- Docker dev runs MongoDB + Redis locally from `docker-compose.dev.yml`

**Policy**
- `docs/conventions/fail-fast.md` is the rule for env handling
- `docs/conventions/env-sync.md` requires updating `env.ts`, `.env.example`, and `.env` together

## Common Commands

- `pnpm dev` — run all workspace dev tasks
- `pnpm build` — build all apps/packages
- `pnpm lint` — run workspace lint
- `pnpm format` — run Prettier over the repo
- `pnpm test` — run workspace tests
- `pnpm --filter api dev|build|test|test:e2e|test:cov` — API-only workflow
- `pnpm --filter web dev|build|test` — web-only workflow
- `pnpm --filter @cyanship/types build` — rebuild shared contracts
- `docker compose -f docker-compose.dev.yml up --build` — local dev stack with MongoDB + Redis
- `docker compose up --build -d` — production-like container stack

## Testing Strategy

- API unit specs live next to modules under `apps/api/src/**/*.spec.ts`
- API e2e coverage lives in `apps/api/test/*.e2e-spec.ts` and uses `MongoMemoryServer` plus Redis/email/payment provider overrides
- Web tests use Jest + jsdom and live next to source files, especially around middleware, auth bootstrap/guard, and API clients

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

- Source of truth for repo-wide rules: `docs/conventions/README.md`
- Read and follow before touching user-facing copy, env/config, or UI structure: `tone.md`, `fail-fast.md`, `i18n.md`, `env-sync.md`, `modular-boundaries.md`, `ui-primitives.md`, `design-tokens.md`
- Full auth and billing behavior docs live in `docs/architecture/auth-flow/README.md` and `docs/architecture/payments-flow/README.md`

## Known Complexities & Debt

- `AuthInitializer` and `app/[locale]/auth/callback/page.tsx` both run refresh/getMe flows, so OAuth callback still causes redundant refresh rotations.
- `apps/web/src/middleware.ts` only checks presence of `bid_refresh`; stale or invalid cookies can still trigger false redirects.
- `apps/web/src/shared/api/payments.ts` prefixes endpoints with `/api/payments/...` on top of `apiClient` base URL. With `.env.example` default `NEXT_PUBLIC_API_URL=/api`, browser requests become `/api/api/payments/...`.
- Frontend `sendMagicLink()` sends `lang`, but backend `AuthService.sendMagicLink()` ignores that input and falls back to `user.preferredLang` or `LANG.UK`; new-email magic links do not honor the current locale.
- `apps/web/src/shared/api/mapApiCode.ts` returns `errors.generic.<code>` for generic fallbacks, but message dictionaries only guarantee `errors.generic.unknown`; missing API-code translations can leak raw keys.
- `apps/web/next.config.ts` still has `API_INTERNAL_URL || 'http://localhost:4000'`, which conflicts with the fail-fast policy documented in `docs/conventions/fail-fast.md`.
- `apps/api/src/app.controller.ts` returns `process.env.NODE_ENV || 'development'` instead of using centralized `ENV`, so health output can drift from loader rules.
- `apps/api/src/modules/reports/`, `apps/api/src/modules/storage/`, and `apps/api/src/modules/agency/` are still scaffold / placeholder areas with incomplete business flow `[NEED_CONTEXT]`.
