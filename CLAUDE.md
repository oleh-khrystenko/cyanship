# CyanShip

> Monorepo-monolith на Next.js 16 + NestJS 11: API володіє auth/session lifecycle, billing, а shared Zod/TypeScript контракти використовуються обома застосунками.

## Tech Stack

| Шар | Технологія | Версія |
|-----|-----------|--------|
| Core | TypeScript, Node.js, pnpm, Turborepo | TS 5.9, Node 20, pnpm 10 |
| Frontend | Next.js (App Router), React, Zustand, TailwindCSS, next-intl | Next 16.0.1, React 19.2 |
| Backend | NestJS, Mongoose, ioredis, Passport | NestJS 11.1, Mongoose 8 |
| Validation | Zod (shared contracts) | Zod 4.3 |
| Payments | Stripe | 20.4 |
| Email | Resend | 6.9 |
| Тести | Jest, Supertest, MongoMemoryServer, @testing-library/react | Jest 30.2 |

## Architecture Overview

Monorepo з трьома workspace: `apps/api`, `apps/web`, `packages/types`. API — system of record для auth, session lifecycle, billing та webhook processing; web залишається тонким клієнтом і спілкується з API через shared Zod контракти. Frontend використовує Feature-Sliced Design. Модульний моноліт зі строгим Core/Agency розділенням — agency код живе в ізольованих шляхах, core не може імпортувати agency (ESLint `no-restricted-imports`). Модулі `reports`, `storage`, `agency` (API) — scaffold/placeholder без бізнес-логіки.

## Project Structure

```
apps/
├── api/src/
│   ├── main.ts, app.module.ts
│   ├── config/          # fail-fast env loader
│   ├── common/          # decorators, filters, guards, providers
│   └── modules/         # auth, users, payments, agency, reports, storage
├── web/src/
│   ├── app/[locale]/    # pages: auth, (protected), (agency)
│   ├── features/        # auth, change-lang, change-theme, profile, agency
│   ├── widgets/         # header, agency/landing
│   ├── shared/          # api, ui, config, styles, icons, seo, lib
│   ├── stores/          # auth, headerNav (Zustand)
│   └── i18n/            # routing, request config
packages/
└── types/src/           # contracts, entities, enums, constants, validation
docs/
├── architecture/        # auth-flow, payments-flow
└── conventions/         # source-of-truth правила
```

## Domain Model

### User
Файл: `apps/api/src/modules/users/schemas/user.schema.ts` | Zod: `packages/types/src/entities/user.ts`
- Soft-delete через `deletedAt` + `accountDeletionRequestedAt` (grace period, щоденний cron hard-delete)
- Embedded `billing` subdocument (nullable, створюється лише при першій billing-події) з `lastProviderEventAt` для out-of-order webhook protection
- Sparse indexes: `provider.id`, `billing.providerCustomerId`, `billing.providerSubscriptionId`

### ProcessedWebhookEvent
Файл: `apps/api/src/modules/payments/schemas/processed-webhook-event.schema.ts`
- Unique `(provider, providerEventId)` — idempotency key для Stripe webhooks
- Two-phase: `status` переходить `pending → applied`; при помилці pending-запис видаляється (rollback)

## Module Dependency Map

- `AppModule` → `AuthModule`, `UsersModule`, `PaymentsModule`, `ReportsModule`, `StorageModule`
- `AuthModule` ↔ `UsersModule` (`forwardRef`, circular)
- `PaymentsModule` → `UsersModule` + `PAYMENT_PROVIDER` injection token
- `CleanupService` (cron) → `AuthService` + `UserModel`
- Web: `shared/api/client.ts` → axios interceptors → refresh dedupe → `authStore`
- Web: protected routes → `AuthGuard` компонент → auth store → `shared/api/auth.ts`
- Agency → Core (одностороння залежність); core НЕ імпортує agency

## Key Patterns

### Створення endpoint
Guard + `@CurrentUser()` decorator + DTO + Service, повертає `{ data: ... }` envelope. Приклад: `apps/api/src/modules/payments/payments.controller.ts`

### Валідація
Zod schema в `packages/types/src/contracts/*` → `createZodDto()` в api dto → ті ж Zod schemas на фронті. Приклад: `apps/api/src/modules/payments/dto/create-checkout-session.dto.ts`

### Авторизація (Guards)
- `JwtActiveGuard` — **основний**, перевіряє JWT + блокує soft-deleted users
- `JwtAuthGuard` — тільки JWT без перевірки soft-delete (використовується для restore)
- `SubscriptionGuard` — перевіряє `hasActiveSubscription`
- Файли: `apps/api/src/common/guards/`

### Auth/session lifecycle
Access JWT в пам'яті (web), refresh JWT в `bid_refresh` httpOnly cookie, Redis token families з ротацією і reuse detection. Axios дедуплікує concurrent refresh calls. Повна документація: `docs/architecture/auth-flow/README.md`

### Billing/webhook processing
Provider abstraction (`PAYMENT_PROVIDER` → `StripeService`), two-phase idempotency через `ProcessedWebhookEvent`, atomic out-of-order guard через `lastProviderEventAt` в MongoDB query. Feature flags контролюють subscription/one-off. Повна документація: `docs/architecture/payments-flow/README.md`

### Error handling та i18n mapping
API повертає machine-readable `code` через `AllExceptionsFilter`; web маппить codes на locale keys через `shared/api/mapApiCode.ts`. Конвенція: `docs/conventions/i18n.md`

### Soft-delete lifecycle
Запит на видалення → `accountDeletionRequestedAt` + `deletedAt` → grace period (default 30 днів) → `CleanupService` cron щоночі о 3:00 hard-delete + revoke tokens. Файл: `apps/api/src/modules/users/cleanup.service.ts`

## API Overview

Global prefix: `/api`. Rate limiting: `ThrottlerModule` (60 req/min global).

### AuthController (`apps/api/src/modules/auth/auth.controller.ts`)
| Метод | Шлях | Guard | Опис |
|-------|------|-------|------|
| GET | `/auth/google` | `AuthGuard('google')` | Старт Google OAuth |
| GET | `/auth/google/callback` | `AuthGuard('google')` | OAuth callback, set refresh cookie |
| POST | `/auth/check-email` | — | Перевірка існування акаунту (rate-limited) |
| POST | `/auth/login/password` | — | Вхід з паролем |
| POST | `/auth/magic-link/send` | — | Відправка magic link |
| POST | `/auth/magic-link/verify` | — | Верифікація magic link token |
| POST | `/auth/password/set` | `JwtActiveGuard` | Встановлення першого паролю |
| POST | `/auth/password/change` | `JwtActiveGuard` | Зміна паролю, revoke all tokens |
| POST | `/auth/password/verify` | `JwtActiveGuard` | Перевірка паролю для sensitive дій |
| POST | `/auth/refresh` | — | Ротація refresh token (cookie) |
| POST | `/auth/logout` | — | Revoke refresh token |

### UsersController (`apps/api/src/modules/users/users.controller.ts`)
| Метод | Шлях | Guard | Опис |
|-------|------|-------|------|
| GET | `/users/me` | `JwtActiveGuard` | Профіль + billing snapshot |
| PATCH | `/users/me` | `JwtActiveGuard` | Оновлення профілю |
| PATCH | `/users/me/lang` | `JwtActiveGuard` | Зміна мови |
| POST | `/users/account/delete` | `JwtActiveGuard` | Запит на видалення |
| POST | `/users/account/delete/confirm` | `JwtActiveGuard` | Підтвердження видалення паролем |
| POST | `/users/account/restore` | `JwtAuthGuard` | Відновлення акаунту |

### PaymentsController (`apps/api/src/modules/payments/payments.controller.ts`)
| Метод | Шлях | Guard | Опис |
|-------|------|-------|------|
| POST | `/payments/checkout-session` | `JwtActiveGuard` | Створення Stripe checkout |
| POST | `/payments/portal-session` | `JwtActiveGuard` | Створення billing portal URL |
| POST | `/payments/webhook/stripe` | — + `@SkipThrottle()` | Stripe webhook ingestion |

### Reports / Storage
Scaffold без ендпоінтів.

## Configuration & Environment

**Loaders**
- API: `apps/api/src/config/env.ts` (fail-fast, crash on missing)
- Web: `apps/web/src/shared/config/env.ts` (process.env для Next.js inlining)
- Шаблон: `.env.example`
- Політика: `docs/conventions/fail-fast.md`, `docs/conventions/env-sync.md`

**API — required (crash if missing)**
- `MONGODB_URI`, `REDIS_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY_USD`
- `RESEND_API_KEY`

**API — optional з defaults**
- `NODE_ENV` → `'development'`, `PORT` → `'4000'`, `WEB_URL` → `'http://localhost:3000'`
- `RESEND_FROM_EMAIL` → dev fallback (`onboarding@resend.dev`)
- Auth tuning: `AUTH_PASSWORD_MIN_LENGTH`, `AUTH_LOCKOUT_THRESHOLDS`, `AUTH_LOGIN_ATTEMPTS_TTL_MIN`, `AUTH_MAGIC_LINK_TTL_MIN`, `AUTH_MAGIC_LINK_RATE_LIMIT`, `AUTH_MAGIC_LINK_RATE_WINDOW_MIN`, `AUTH_MAGIC_LINK_DEDUP_SEC`, `ACCOUNT_DELETION_GRACE_DAYS`

**API — conditionally required**
- `STRIPE_PRICE_CREDITS_5_USD`, `STRIPE_PRICE_CREDITS_10_USD`, `STRIPE_PRICE_CREDITS_20_USD` — тільки якщо `PAYMENTS_ONE_OFF_ENABLED=true`

**Feature flags** (default: enabled)
- `PAYMENTS_SUBSCRIPTION_ENABLED`, `PAYMENTS_ONE_OFF_ENABLED`
- Web аналоги: `NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED`, `NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED`

**Web — required**
- `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`

**Web — optional**
- `API_INTERNAL_URL` — server-side reverse proxy target

**Infra**
- `WEB_PORT`, `API_PORT` — Docker compose порти

## Common Commands

```
pnpm dev                                              # dev all workspaces
pnpm build                                            # build all
pnpm lint                                             # lint all
pnpm format                                           # Prettier
pnpm test                                             # test all

pnpm --filter api dev|build|test|test:e2e|test:cov    # API-only
pnpm --filter web dev|build|test                      # Web-only
pnpm --filter @cyanship/types build                  # rebuild shared types

pnpm --filter api -- jest path/to/file.spec.ts        # один API тест
pnpm --filter web -- jest path/to/file.test.ts        # один Web тест

docker compose -f docker-compose.dev.yml up --build   # dev (Mongo + Redis)
docker compose up --build -d                          # prod-like
```

## Testing Strategy

- API unit specs: `apps/api/src/**/*.spec.ts` (поруч з модулями)
- API e2e: `apps/api/test/*.e2e-spec.ts` (MongoMemoryServer + provider overrides)
- Web: Jest + jsdom, поруч з source файлами
- Test env setup: `apps/api/src/test-setup.ts` — fallback env vars для unit тестів (placeholder values, запобігає fail-fast crash)
- CI: `.github/workflows/ci.yml` (lint → build → API tests з MongoDB service)

<!-- MANUAL:START -->
# Rules

- Before making ANY code changes, read the relevant module's files to understand current implementation
- Always check existing patterns in similar modules before creating new ones

## Project Conventions (MANDATORY)

All AI agents MUST read and follow rules in `docs/conventions/`:

- **[Tone & Style](docs/conventions/tone.md)** — tone and style for all user-facing messages (toasts, errors, confirmations)
- **[Fail Fast](docs/conventions/fail-fast.md)** — required env vars policy, no silent fallbacks

Full index: [docs/conventions/README.md](docs/conventions/README.md)
  <!-- MANUAL:END -->

## Rules & Conventions

- Source of truth для repo-wide правил: `docs/conventions/README.md`
- Читай перед роботою з відповідними зонами: `tone.md`, `fail-fast.md`, `i18n.md`, `env-sync.md`, `modular-boundaries.md`, `ui-primitives.md`, `design-tokens.md`
- Повна документація auth та billing flow: `docs/architecture/auth-flow/README.md`, `docs/architecture/payments-flow/README.md`

## Known Complexities

- **rawBody для Stripe**: `NestFactory.create(AppModule, { rawBody: true })` в `main.ts` — без цього signature verification ламається. Webhook endpoint використовує `RawBodyRequest`.
- **AuthModule ↔ UsersModule circular**: обидва імпортують один одного через `forwardRef`. Порушення цього патерну = Nest DI crash.
- **Refresh token rotation atomic**: `GETDEL` в Redis забезпечує single-use. Reuse detection (missing key) тригерить повний revoke всіх токенів користувача (security measure).
- **Out-of-order webhooks**: Subscription billing updates використовують `lastProviderEventAt` guard в MongoDB atomic query. Старіші events тихо пропускаються. Це НЕ баг.
- **Refresh cookie працює через proxy**: `next.config.ts` проксує `/api/*` на backend — тому `bid_refresh` cookie (httpOnly) видимий і в middleware, і в API (same origin).
- **`test-setup.ts` fallback env**: Без цього файлу fail-fast policy крашить Jest ще до запуску тестів.
- **`packages/types` build order**: Має бути зібраний ДО `apps/api` та `apps/web`. Turborepo `dependsOn: ["^build"]` це забезпечує, але manual build без turbo зламається.
- **Web API double prefix**: `shared/api/payments.ts` додає `/api/payments/...` поверх `apiClient` base URL. З `.env.example` default `NEXT_PUBLIC_API_URL=/api` запити стають `/api/api/payments/...`.
- **Magic link locale**: `sendMagicLink()` на фронті відправляє `lang`, але backend ігнорує і використовує `user.preferredLang` або fallback `LANG.UK`.
