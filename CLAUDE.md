# CyanShip

> Monorepo-monolith на Next.js 16 + NestJS 11: API володіє auth/session lifecycle, billing, executions, AI chat та agency brief submission, а shared Zod/TypeScript контракти використовуються обома застосунками.

## Tech Stack

| Шар | Технологія | Версія |
|-----|-----------|--------|
| Core | TypeScript, Node.js, pnpm, Turborepo | TS 5.9, Node 20, pnpm 10.30 |
| Frontend | Next.js (App Router + Turbopack), React, Zustand, TailwindCSS, next-intl | Next 16.0.1, React 19.2, Zustand 5, Tailwind 4, next-intl 4.4 |
| Forms | React Hook Form + @hookform/resolvers (Zod) | RHF 7.72 |
| Backend | NestJS, Mongoose, ioredis, Passport | NestJS 11.1, Mongoose 8 |
| Validation | Zod (shared contracts) | Zod 4.3 |
| AI | Anthropic SDK (Claude Haiku 4.5) | SDK 0.80 |
| Payments | Stripe | 20.4 |
| Email | Resend + React Email | 6.9 |
| CAPTCHA | Cloudflare Turnstile | — |
| Storage | Cloudflare R2 (S3 SDK + presigner), `sharp`, `react-easy-crop` | SDK 3, sharp 0.34 |
| Тести | Jest, Supertest, MongoMemoryServer, @testing-library/react | Jest 30.2 |

## Architecture Overview

Monorepo з трьома workspace: `apps/api`, `apps/web`, `packages/types`. API — system of record для auth, session lifecycle, billing, executions, AI chat, agency brief submission та media storage; web залишається тонким клієнтом і спілкується з API через shared Zod контракти. Frontend використовує Feature-Sliced Design. Модульний моноліт зі строгим Core/Agency розділенням — agency код живе в ізольованих шляхах, core не може імпортувати agency (ESLint `no-restricted-imports`). Модуль `reports` (API) — scaffold/placeholder без бізнес-логіки. Модуль `storage` — avatar upload pipeline через Cloudflare R2 (presigned PUT + server-side Google avatar re-upload з `sharp`). Модуль `agency` — brief submission з Turnstile CAPTCHA + authenticated brief для AI bonus grant. Модуль `ai` — streaming chat з Anthropic через SSE, з execution-based billing та rate limiting.

## Project Structure

```
apps/
├── api/src/
│   ├── main.ts, app.module.ts
│   ├── config/          # fail-fast env loader
│   ├── common/          # decorators, filters, guards, interceptors, modules (Redis), services
│   └── modules/         # auth, email, users, payments, agency, ai, reports, storage
├── web/src/
│   ├── app/[locale]/    # pages: auth, (protected), (agency)
│   ├── entities/        # user (authStore), navigation (headerNavStore), brand (Logo), agency (placeholder)
│   ├── features/        # auth, billing, agency, profile, change-lang, change-theme — own their dialog/state stores in-slice
│   ├── widgets/         # header (mobileMenuSheetStore), agency/landing (dogfoodingSheetStore)
│   ├── shared/          # api, ui, config, styles, icons, seo, lib (authEvents + uiIntents buses), fonts, types
│   └── i18n/            # routing, request config
packages/
└── types/src/           # contracts, entities, enums, constants, validation, utils, agency
docs/
├── architecture/        # auth-flow, payments-flow
├── conventions/         # source-of-truth правила
├── prompts/             # agent context-update prompts
├── testing/             # auth, payments test plans
└── vision/              # CyanShip business model (видаляється при форку)
```

## Domain Model

### User
Файл: `apps/api/src/modules/users/schemas/user.schema.ts` | Zod: `packages/types/src/entities/user.ts`
- Soft-delete через `deletedAt` + `accountDeletionRequestedAt` (grace period, cron hard-delete)
- Embedded `billing` subdocument (nullable, створюється лише при першій billing-події) з `lastProviderEventAt` для out-of-order webhook protection
- Embedded `executions` subdocument (`balance`, `freeReportUsed`, `activeReservation`) з atomic `$inc` операціями
- Embedded `ai` subdocument (`requestsUsed`, `bonusGranted`) — lifetime AI chat usage tracking
- Sparse indexes: `provider.id`, `billing.providerCustomerId`, `billing.providerSubscriptionId`, `executions.activeReservation.expiresAt`

### ExecutionTransaction
Файл: `apps/api/src/modules/users/schemas/execution-transaction.schema.ts`
- Ledger для credit/debit операцій з executions (type, action, amount, balanceAfter)
- Compound index `(userId, createdAt desc)` для швидких запитів останніх транзакцій

### ChatMessage
Файл: `apps/api/src/modules/ai/schemas/chat-message.schema.ts`
- Повідомлення AI чату (userId, role: user|assistant, content)
- Compound index `(userId, createdAt)` для отримання історії по користувачу

### ProcessedWebhookEvent
Файл: `apps/api/src/modules/payments/schemas/processed-webhook-event.schema.ts`
- Unique `(provider, providerEventId)` — idempotency key для Stripe webhooks
- Two-phase: `status` переходить `pending → applied`; при помилці pending-запис видаляється (rollback)

### OrphanedProviderCustomer
Файл: `apps/api/src/modules/payments/schemas/orphaned-provider-customer.schema.ts`
- Unique `(provider, providerCustomerId)` — черга невдалих видалень Stripe customers
- Retry з лічильником `attempts` (max 5), cron `PaymentsCleanupService`

### Brief
Файл: `apps/api/src/modules/agency/schemas/brief.schema.ts`
- Заявка від клієнта (name, email, description, budget, deadline, status)
- Status index; статуси визначені в `packages/types/src/agency/brief.ts`

## Module Dependency Map

- `AppModule` → `AuthModule`, `EmailModule`, `UsersModule`, `PaymentsModule`, `ReportsModule`, `StorageModule`, `AgencyModule`, `AiModule`
- `AppModule` global providers: `ThrottlerGuard` (APP_GUARD), `OnboardingInterceptor` (APP_INTERCEPTOR)
- `AuthModule` ↔ `UsersModule` (`forwardRef`, circular)
- `AuthModule` → `StorageModule` (for Google avatar re-upload у `handleGoogleAuth`)
- `EmailModule` — `@Global()`, доступний всім модулям
- `RedisModule` — `@Global()`, exports `REDIS_CLIENT` token + `RedisCounterService` (Lua-based atomic counters)
- `PaymentsModule` → `UsersModule` + `PAYMENT_PROVIDER` injection token + `CatalogService` + `REDIS_CLIENT`
- `CatalogService` → own Stripe SDK instance + `REDIS_CLIENT` (no dependency on `IPaymentProvider`)
- `AgencyModule` → `EmailModule` (global) + `UsersModule` (for AI bonus) + `TurnstileService` + `BriefService`
- `AiModule` → `UsersModule` + `REDIS_CLIENT` + `AI_PROVIDER` injection token (AnthropicService)
- `StorageModule` → `UsersModule` + `STORAGE_PROVIDER` injection token (CloudflareR2Service); exports `StorageService` (consumed by `AuthModule`)
- `CleanupService` (cron, every 6h) → `AuthService` + `UserModel`
- `ReservationReconcileService` (cron, every 5min) → `UsersService` — generic expired reservation refund
- `PaymentsCleanupService` (cron, 4 AM) → `PAYMENT_PROVIDER` + `OrphanedProviderCustomerModel`
- Web: `shared/api/client.ts` → axios interceptors → refresh dedupe → `authStore`
- Web: protected routes → `AuthGuard` компонент → auth store → `shared/api/auth.ts`
- Agency → Core (одностороння залежність); core НЕ імпортує agency

## Key Patterns

### Створення endpoint
Guard + `@CurrentUser()` decorator + DTO + Service, повертає `{ data: ... }` envelope. Приклад: `apps/api/src/modules/payments/payments.controller.ts`

### Валідація
Zod schema в `packages/types/src/contracts/*` → `createZodDto()` в api dto → ті ж Zod schemas на фронті через `@hookform/resolvers/zod`. Приклад: `apps/api/src/modules/payments/dto/create-checkout-session.dto.ts`

### Форми (Frontend)
React Hook Form + Zod resolver для всіх форм. Приклад: `apps/web/src/features/profile/ProfileForm.tsx`

### Авторизація (Guards)
- `JwtActiveGuard` — **основний**, перевіряє JWT + блокує soft-deleted users
- `JwtAuthGuard` — тільки JWT без перевірки soft-delete (використовується для restore)
- `SubscriptionGuard` — перевіряє `hasActiveSubscription`
- `AiRateLimitGuard` — lifetime account limit (MongoDB) + IP-based Redis rate limit (24h TTL)
- Файли: `apps/api/src/common/guards/`, `apps/api/src/modules/ai/guards/`

### Onboarding enforcement
Глобальний `OnboardingInterceptor` (APP_INTERCEPTOR) блокує роути з кодом `ONBOARDING_INCOMPLETE` поки профіль не заповнений. Пропускається через `@SkipOnboarding()`. Файли: `apps/api/src/common/interceptors/onboarding.interceptor.ts`, `apps/api/src/common/decorators/skip-onboarding.decorator.ts`

### Auth/session lifecycle
Access JWT в пам'яті (web), refresh JWT в `bid_refresh` httpOnly cookie, Redis token families з ротацією і reuse detection. Axios дедуплікує concurrent refresh calls. Документація: `docs/architecture/auth-flow/README.md`

### Billing/webhook processing
Provider abstraction (`PAYMENT_PROVIDER` → `StripeService`), two-phase idempotency через `ProcessedWebhookEvent`, atomic out-of-order guard через `lastProviderEventAt`. Feature flags контролюють subscription/one-off. Orphaned customer cleanup через `OrphanedProviderCustomer` + daily cron. Документація: `docs/architecture/payments-flow/README.md`

### Billing catalog (Stripe as single source of truth)
`CatalogService` (`apps/api/src/modules/payments/catalog.service.ts`) fetches Products/Prices from Stripe API, caches in Redis (TTL 5 min). Has own Stripe SDK instance (not via `IPaymentProvider`) to avoid circular DI. Warms cache on startup (fail-fast). Public endpoint `GET /payments/catalog` — no auth, applies feature flags. Plan/pack codes remain as TypeScript union types (`SubscriptionPlanCode`, `ExecutionPackCode`) — structural identifiers for i18n keys, images, DB records. Business data (prices, executions, display order, featured) comes exclusively from Stripe Product metadata.

### AI chat streaming
Provider abstraction (`AI_PROVIDER` → `AnthropicService`), SSE через `res.write()`. Durable reservation pattern: `AiService.reserveChatRequest()` робить atomic `findOneAndUpdate` (balance + account limit + single-flight guard + compensationOps), потім stream, потім commit або refund. 2-layer protection: IP rate limit (Redis Lua) і atomic durable reservation. Abort policy: refundable до першого токена, non-refundable після. Файл: `apps/api/src/modules/ai/ai.controller.ts`

### Reservation primitives (generic core API)
`UsersService.commitReservation()` — MongoDB transaction з claim-first порядком. `UsersService.refundReservation()` — single atomic `findOneAndUpdate`, що застосовує `compensationOps` зі збереженого reservation document. `ReservationReconcileService` — generic cron (кожні 5 хвилин) для expired reservations. Будь-який feature, що мутує власні поля під час reserve, декларує compensation у `activeReservation.compensationOps`.

### AI bonus grant через brief
Authenticated brief endpoint (`POST /agency/brief/authenticated`) дає AI bonus (5 додаткових запитів). Server-side sets `requestAiBonus: true` + `userId`; `BriefService` atomically sets `user.ai.bonusGranted: true`. Frontend brief dialog підтримує `requestAiBonus` mode через Zustand store.

### Avatar upload pipeline (R2)
Provider abstraction (`STORAGE_PROVIDER` → `CloudflareR2Service`, S3-compatible SDK). Three-step client flow: `POST /storage/avatar/upload-url` → direct PUT до R2 → `POST /storage/avatar/commit`. API ніколи не проксує файли. Presigned PUT підписує лише `Content-Type: image/webp`. Size enforcement на application layer: client pre-check → `HeadObject` при commit з `deleteObject` cleanup при rejection → throttler на presigned URL endpoint. File key: `avatars/{userId}/{uuid}.webp` (`AVATAR_FILE_KEY_REGEX` у `packages/types/src/contracts/storage.ts`). Client: `react-easy-crop` → `canvas.toBlob('image/webp', 0.85)` → `uploadToR2()` (native `fetch`, не `apiClient`). HEIC свідомо **не підтримується**: browser-side HEIC-декодери транзитивно тягнуть libheif (LGPL-3.0), несумісне з permissive-ліцензійним профілем репо; iOS Safari ≥14 сам конвертує HEIC → JPEG, якщо `accept` не містить `image/heic`. Файл: `apps/api/src/modules/storage/storage.service.ts`

### Google OAuth avatar re-upload
При Google OAuth callback `AuthService.handleGoogleAuth` **синхронно** викликає `StorageService.reUploadExternalAvatar()` (fetch Google URL → `sharp.resize(512×512, cover).webp({ quality: 85 })` → `uploadBuffer` у R2) перед `generateTokens`. Failure → `logger.warn` + fall through з external URL.

### Error handling та i18n mapping
API повертає machine-readable `code` через `AllExceptionsFilter`; web маппить codes на locale keys через `shared/api/mapApiCode.ts`. Конвенція: `docs/conventions/i18n.md`

### Soft-delete lifecycle
Запит на видалення → `accountDeletionRequestedAt` + `deletedAt` → grace period → `CleanupService` cron кожні 6 годин hard-delete + revoke tokens. Файл: `apps/api/src/modules/users/cleanup.service.ts`

### Frontend auth flow
`AuthInitializer` (client effect) → `refreshToken()` → `getMe()` → hydrate `authStore`. Перевіряє terms version, показує modal при outdated. `AuthGuard` компонент в protected layout перевіряє auth + onboarding. Middleware (`middleware.ts`) перевіряє `bid_refresh` cookie для server-side redirects.

### Overlay management
Zustand store → `UiModal`/`UiSheet`/`UiConfirmDialog` → реєстрація в `app/overlays.tsx` (єдиний global mount + єдиний санкціонований core→agency dynamic-import exception). Конвенція: `docs/conventions/overlays.md`. Кожен dialog store живе **усередині свого slice** — глобального `src/stores/` шару не існує (enforced ESLint). **In-module trigger**: прямий import store з барелю slice. **Cross-module trigger** (core ↔ agency): через `uiIntents` bus.

### FSD layer inversion via event bus
Два механізми інверсії залежностей у `shared/lib/`:
- **`authEvents`** — parameterless lifecycle events (нижчий шар `shared/api` публікує, `entities/user/authStore` реагує на `'session-lost'`)
- **`uiIntents`** — типізовані cross-slice imperative UI commands з payload (`'open-brief-dialog'` від core до agency)

ESLint guardrails блокують прямі обходи: `SHARED_MUST_NOT_IMPORT_HIGHER_LAYERS`, `CORE_MUST_NOT_IMPORT_AGENCY` — і для static `import` (`no-restricted-imports`), і для dynamic `import()` (`no-restricted-syntax`). Єдиний виняток — `app/overlays.tsx` (file-scoped у конфізі).

### Execution ledger
Atomic `$inc` на `user.executions.balance` + створення `ExecutionTransaction`. Spend-ендпоінт перевіряє достатність балансу. AI chat створює transaction з action `AI_CHAT`. Файл: `apps/api/src/modules/users/users.service.ts`

## API Overview

Global prefix: `/api`. Rate limiting: `ThrottlerModule` (60 req/min global). Global pipes: `ZodValidationPipe`. Global filters: `AllExceptionsFilter`.

### AppController (`apps/api/src/app.controller.ts`)
| Метод | Шлях | Guard | Опис |
|-------|------|-------|------|
| GET | `/` | — | Root endpoint |
| GET | `/health` | — | Health check + timestamp + env |

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
| POST | `/auth/password/reset` | — | Скидання паролю через magic link token |
| POST | `/auth/password/verify` | `JwtActiveGuard` | Перевірка паролю для sensitive дій |
| POST | `/auth/refresh` | — | Ротація refresh token (cookie) |
| POST | `/auth/logout` | — | Revoke refresh token |

### UsersController (`apps/api/src/modules/users/users.controller.ts`)
| Метод | Шлях | Guard | Опис |
|-------|------|-------|------|
| GET | `/users/me` | `JwtActiveGuard` | Профіль + billing snapshot |
| PATCH | `/users/me` | `JwtActiveGuard` | Оновлення профілю |
| PATCH | `/users/me/lang` | `JwtActiveGuard` | Зміна мови |
| POST | `/users/me/accept-terms` | `JwtActiveGuard` | Прийняття ToS версії |
| POST | `/users/me/executions/spend` | `JwtActiveGuard` | Витрата executions |
| GET | `/users/me/executions/transactions` | `JwtActiveGuard` | Історія транзакцій executions |
| POST | `/users/account/delete` | `JwtActiveGuard` | Запит на видалення |
| POST | `/users/account/delete/confirm` | `JwtActiveGuard` | Підтвердження видалення паролем |
| POST | `/users/account/restore` | `JwtAuthGuard` | Відновлення акаунту |

### PaymentsController (`apps/api/src/modules/payments/payments.controller.ts`)
| Метод | Шлях | Guard | Опис |
|-------|------|-------|------|
| GET | `/payments/catalog` | — + `@SkipOnboarding()` + `@SkipThrottle()` | Product catalog (from Stripe, cached) |
| POST | `/payments/checkout-session` | `JwtActiveGuard` | Створення Stripe checkout |
| POST | `/payments/portal-session` | `JwtActiveGuard` | Створення billing portal URL |
| POST | `/payments/reset` | `JwtActiveGuard` | Скидання billing (видалення Stripe customer) |
| POST | `/payments/webhook/:provider` | — + `@SkipThrottle()` | Stripe webhook ingestion |

### AiController (`apps/api/src/modules/ai/ai.controller.ts`)
| Метод | Шлях | Guard | Опис |
|-------|------|-------|------|
| POST | `/ai/chat` | `JwtActiveGuard` + `AiRateLimitGuard` | SSE streaming chat (execution cost: 200) |
| GET | `/ai/chat/history` | `JwtActiveGuard` | Історія повідомлень чату |
| DELETE | `/ai/chat/history` | `JwtActiveGuard` | Очищення історії чату |

### BriefController (`apps/api/src/modules/agency/brief.controller.ts`)
| Метод | Шлях | Guard | Опис |
|-------|------|-------|------|
| POST | `/agency/brief` | — + `@SkipOnboarding()` | Подача brief (Turnstile CAPTCHA) |
| POST | `/agency/brief/authenticated` | `JwtActiveGuard` | Brief + AI bonus grant |

### StorageController (`apps/api/src/modules/storage/storage.controller.ts`)
| Метод | Шлях | Guard | Опис |
|-------|------|-------|------|
| POST | `/storage/avatar/upload-url` | `JwtActiveGuard` | Presigned PUT URL (Content-Type signed, 5-min TTL) |
| POST | `/storage/avatar/commit` | `JwtActiveGuard` | HeadObject verify + update profile.avatar + delete old file |
| DELETE | `/storage/avatar` | `JwtActiveGuard` | Clear profile.avatar + delete R2 file |

### Reports
Scaffold без ендпоінтів.

## Configuration & Environment

Один `.env` у корені монорепо — спільний для обох застосунків. Шаблон: `.env.example`. Політика: `docs/conventions/fail-fast.md`.

**Loaders**
- API: `apps/api/src/config/env.ts` (fail-fast, crash on missing)
- Web (runtime/browser): `apps/web/src/shared/config/env.ts` (direct `process.env.VAR` для Next.js inlining)
- Web (build): `apps/web/next.config.ts` — власний `requireEnv`, бо конфіг виконується в Node build context поза client env модулем

**API — ALL required (crash if missing, no defaults)**
- `NODE_ENV`, `API_PORT`, `WEB_URL`
- `MONGODB_URI`, `REDIS_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `TURNSTILE_SECRET_KEY`, `BRIEF_NOTIFICATION_EMAIL`
- AI: `ANTHROPIC_API_KEY`
- Storage (R2): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

**Спільні значення — одна змінна, інлайн у web бандл**
`next.config.ts` (ключ `env`) мапить API-змінні на `NEXT_PUBLIC_*` імена, тому окремих web-копій у `.env` НЕМАЄ:
- `WEB_URL` → `NEXT_PUBLIC_BASE_URL` (canonical/OG на web; CORS, листи, Stripe return URLs на API)
- `R2_PUBLIC_URL` → `NEXT_PUBLIC_STORAGE_URL` (`storage.origin`; з нього ж береться `next/image` `remotePatterns` hostname + protocol)

**Web — required у `.env`**
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `API_INTERNAL_URL` — reverse proxy target для rewrites у `next.config.ts`. Обов'язковий, бо браузер ходить лише на `API_BASE_PATH` (`/api` на web-origin): без rewrite кожен виклик API — Next 404. Мусить бути origin без path і trailing slash.

**Web — optional**
- `NEXT_PUBLIC_DEMO_VIDEO_PATH`, `NEXT_PUBLIC_DEMO_VIDEO_POSTER_PATH` — шляхи в R2-бакеті (мусять починатись з `/`, склеюються з `NEXT_PUBLIC_STORAGE_URL`). Постер без відео = помилка збірки; відео вмикає demo-секцію на landing.

**Не env vars**
- Шлях до API — константа `API_BASE_PATH = '/api'` (`apps/web/src/shared/config/api.ts`), бо `bid_refresh` cookie вимагає same-origin проксі. `NEXT_PUBLIC_API_URL` більше не існує.
- Продуктовий тюнінг живе в коді (`docs/conventions/fail-fast.md`, розділ «Що НЕ є env var»): `packages/types/src/constants/account.ts` (`ACCOUNT_DELETION_GRACE_DAYS`), `constants/payments.ts` (`PAYMENTS_SUBSCRIPTION_ENABLED`, `PAYMENTS_ONE_OFF_ENABLED` — хоча б один `true`, перевіряє `CatalogService.onModuleInit`), `contracts/ai-chat.ts` (`AI_CHAT_COST`, `AI_CHAT_FREE_LIMIT`, `AI_CHAT_BONUS_AMOUNT`). Локальні: `auth.service.ts` (`LOGIN_ATTEMPTS_TTL`, `MAGIC_LINK_*`, `LOCKOUT_THRESHOLDS`), `ai.service.ts` (`AI_CHAT_MAX_TOKENS`), `ai-rate-limit.guard.ts` (`AI_CHAT_IP_LIMIT`).

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

docker compose -f docker-compose.dev.yml up --build   # dev (Redis only)
docker compose up --build -d                          # prod-like
```

## Testing Strategy

- API unit specs: `apps/api/src/**/*.spec.ts` (поруч з модулями)
- API e2e: `apps/api/test/*.e2e-spec.ts` (MongoMemoryServer + provider overrides)
- Web: Jest + jsdom, поруч з source файлами
- Test env setup: `apps/api/src/test-setup.ts` — fallback env vars для unit і e2e тестів (placeholder values через `??=`, запобігає fail-fast crash)
- Test docs: `docs/testing/auth/`, `docs/testing/payments/` — unit/integration + manual E2E test plans
- CI: `.github/workflows/ci.yml` (lint → build → API unit tests → API e2e tests)
- Deploy: `.github/workflows/deploy.yml` (SSH → Docker build → health checks → auto-rollback)

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
- Читай перед роботою з відповідними зонами: `tone.md`, `fail-fast.md`, `i18n.md`, `modular-boundaries.md`, `ui-primitives.md`, `forms.md`, `design-tokens.md`, `overlays.md`, `responsive.md`
- Повна документація auth та billing flow: `docs/architecture/auth-flow/README.md`, `docs/architecture/payments-flow/README.md`

## Known Complexities

- **rawBody для Stripe**: `NestFactory.create(AppModule, { rawBody: true })` в `main.ts` — без цього signature verification ламається. Webhook endpoint використовує `RawBodyRequest`.
- **AuthModule ↔ UsersModule circular**: обидва імпортують один одного через `forwardRef`. Порушення = Nest DI crash.
- **Refresh token rotation atomic**: `GETDEL` в Redis забезпечує single-use. Reuse detection (missing key) тригерить повний revoke всіх токенів користувача. Grace period 10s для concurrent tabs.
- **Out-of-order webhooks**: subscription updates використовують `lastProviderEventAt` guard в MongoDB atomic query (`$lt`, не `$lte`). Старіші events тихо пропускаються. Це НЕ баг.
- **Refresh cookie працює через proxy**: `next.config.ts` проксує `/api/*` на backend — тому `bid_refresh` cookie (httpOnly) видимий і в middleware, і в API (same origin). Через це ж шлях до API — константа, а не env var.
- **`NEXT_PUBLIC_*` без запису в `.env`**: `NEXT_PUBLIC_BASE_URL` і `NEXT_PUBLIC_STORAGE_URL` не шукати в `.env` — вони приходять із мапінгу `env` у `next.config.ts`. Додаючи ще одну спільну змінну, дублювати її під web-іменем не можна.
- **Docker build args для web**: `next.config.ts` читає env на етапі збірки, тому кожна змінна, потрібна фронту, мусить бути `ARG`+`ENV` у `apps/web/Dockerfile` і build-арг у `compose.yaml`. Забути — падіння збірки образу, не runtime.
- **`test-setup.ts` fallback env**: без цього файлу fail-fast policy крашить Jest ще до запуску тестів. Використовує `??=` — не перезаписує реальні env vars.
- **`packages/types` build order**: має бути зібраний ДО `apps/api` та `apps/web`. Turborepo `dependsOn: ["^build"]` це забезпечує, але manual build без turbo зламається.
- **Magic link locale**: `AuthService.sendMagicLink()` визначає локаль листа за пріоритетом `user?.preferredLang ?? requestLang ?? LANG.EN` — існуючий користувач завжди отримує листа збереженою мовою (фронтовий `lang` ігнорується), `requestLang` діє лише для нових адрес.
- **Webhook route dynamic provider**: URL шаблон `/webhook/:provider`, але підтримується тільки `stripe`. Невідомий provider тихо відхиляється.
- **Orphaned customer retry cap**: `PaymentsCleanupService` робить максимум 5 спроб видалити Stripe customer. Після 5 невдач запис лишається назавжди — потребує ручного втручання.
- **CatalogService own Stripe instance**: власний `new Stripe(...)` для читання Products/Prices, щоб уникнути circular DI з `IPaymentProvider` → `StripeService`. Обидва інстанси на одному `STRIPE_SECRET_KEY`.
- **Catalog cache startup**: `CatalogService.onModuleInit()` робить warm fetch до Stripe. Stripe недоступний при старті → app crash (fail-fast). Після старту працює Redis TTL fallback.
- **Execution proration на plan change**: `calculatePlanChangeAdjustment()` в `PaymentsService` рахує пропорцію залишку періоду. Використовує `previousPriceId` з webhook event та `getPriceToExecutionsMap()`.
- **AI chat SSE після headers**: після `res.flushHeaders()` помилки більше не можуть бути HTTP errors — йдуть як SSE events типу `ERROR`. Reservation відбувається ДО SSE headers, тому 4xx (balance, limit, active reservation) йде звичайним HTTP error.
- **AI chat durable reservation**: reserve (atomic `findOneAndUpdate`, без транзакції) → stream → commit (MongoDB transaction, claim-first) або refund (atomic single-doc op). `ReservationReconcileService` cron — safety net для crash-window.
- **Redis atomic counters via Lua**: `RedisCounterService` використовує `redis.eval()`. Fixed-window: TTL тільки при першому increment. Sliding-window: TTL оновлюється при кожному. Обидва повертають post-increment count.
- **Reservation compensation pattern**: `activeReservation.compensationOps` зберігає `$inc` операції, які core `refundReservation` застосовує атомарно. Cron-reconciler повністю generic. Для AI: `{ inc: { 'ai.requestsUsed': -1 } }`.
- **AI bonus grant one-time**: `BriefService` використовує MongoDB atomic guard (`ai.bonusGranted: false`) проти повторного нарахування.
- **Presigned PUT signs Content-Type only**: `Content-Length` НЕ підписується навмисно — це forbidden request header у Fetch, а signed `ContentLength` у PUT — exact-match, не upper bound. Клієнт мусить відправити рівно `Content-Type: image/webp`, інакше R2 → 403 `SignatureDoesNotMatch`.
- **Avatar size enforcement на application layer**: authenticated user може тимчасово upload'ити oversized файл у свій namespace, але commit-time `HeadObject` одразу зловить і видалить. Для великих/публічних media — міграція на presigned POST з `content-length-range` policy.
- **R2 URL detection для safe delete**: `StorageService.isR2Url()` — prefix-check проти `ENV.R2_PUBLIC_URL`. Зовнішні URL (legacy Google `lh3.googleusercontent.com`) пропускають R2 delete без помилки.
- **Commit idempotency**: повторний `commitAvatarUpload` з тим самим fileKey (мережевий retry) повертає existing URL без повторного `safeDeleteR2File(oldUrl)` — без цього guard другий виклик видалив би щойно збережений файл.
- **Storage error mapping contract**: всі raw SDK/network/sharp помилки в avatar pipeline обгорнуті `mapStorageError()` → `InternalServerErrorException({ code: AVATAR_UPLOAD_FAILED })`. Структуровані `HttpException` з власним кодом пропускаються untouched.
- **Orphaned R2 files trade-off**: upload без commit лишає файл у `avatars/{userId}/`. На MVP acceptable (~50-200 KB після crop+WebP). На scale — TTL cron або lifecycle policy.
- **Sharp на Alpine Docker**: sharp 0.33+ підтягує prebuilt libvips для musl через `optionalDependencies` — `node:20-alpine` працює без правок. Якщо prebuilt недоступний — fallback `apk add --no-cache vips` у runtime stage.
- **OAuth callback sync re-upload**: `handleGoogleAuth` викликає `reUploadExternalAvatar` синхронно перед видачею токенів (+300-800ms), щоб уникнути UX-стрибка URL. Failure non-critical — наступний login повторює спробу.
- **Client disconnect слухається на `res`, не на `req`**: `req` емітить `'close'` одразу після зчитування тіла запиту, тому listener у контролері або не спрацює, або спрацює миттєво. Реальний обрив — `res.on('close')`; відрізнити від нормального завершення дає `res.writableEnded`. Файл: `apps/api/src/modules/ai/ai.controller.ts`
- **E2E тести збирають модуль вручну**: набори не імпортують `AppModule` — кожен перелічує модулі сам. Глобальні провайдери (`ThrottlerGuard`, `OnboardingInterceptor`) треба дублювати в кожній фікстурі, інакше e2e пропускає запити, які прод відхиляє. `RedisModule`/`EmailModule` вказувати явно (глобальність не реєструє провайдера, якщо модуля немає в графі), `CatalogService` — обов'язково мокати (його `onModuleInit` б'є в реальний Stripe). Спільні тест-дублі — `apps/api/test/utils/`.
- **E2E мусить слухати на 127.0.0.1 (`listenOnLoopback`)**: кожен набір викликає `listenOnLoopback(app)` (`test/utils/listen.ts`) одразу після `app.init()`. Без цього supertest відкриває новий ефемерний порт на кожен запит і робить це на wildcard-адресі, а mongod паралельного jest-воркера може займати той самий порт на `127.0.0.1` — запит обслуговує mongod і повертає чужу `404`. Симптом виглядає як випадковий флак у CI.
