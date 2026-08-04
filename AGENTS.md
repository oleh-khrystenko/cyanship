# CyanShip

> SaaS-ядро та живий сайт агенції для швидкого запуску web-продуктів з готовими auth, billing, AI chat, i18n і media storage.

## Tech Stack

| Шар | Технологія | Версія |
| --- | --- | --- |
| Runtime і monorepo | Node.js, TypeScript, pnpm, Turborepo | Node 20, TS 5.9, pnpm 10.30, Turbo 2.5 |
| Web | Next.js App Router, React | Next 16.0, React 19.2 |
| UI і стан | Tailwind CSS, Zustand, React Hook Form | Tailwind 4, Zustand 5, RHF 7 |
| i18n | next-intl | 4.4 |
| API | NestJS | 11.1 |
| Дані | MongoDB, Mongoose, Redis/ioredis | Mongoose 8, Redis 7 |
| Auth | Passport, JWT, Google OAuth | Passport 0.7 |
| Контракти | Zod, nestjs-zod | Zod 4.3 |
| Платежі | Stripe | SDK 20.4 |
| AI | Anthropic SDK, SSE | SDK 0.80 |
| Тести | Jest, Testing Library, Supertest, MongoMemoryServer | Jest 30.2 |

## Architecture Overview

Це pnpm/Turborepo monorepo з трьома workspace: NestJS API, Next.js web і спільні Zod/TypeScript контракти. API є джерелом правди для користувачів, сесій, billing, executions, AI chat, briefs і storage; web залишається клієнтом через same-origin `/api`. Frontend дотримується Feature-Sliced Design, backend — modular monolith. Core не може залежати від Agency; межі перевіряє ESLint. `reports` лишається scaffold без endpoint-логіки, решта зареєстрованих модулів реалізована.

## Project Structure

```text
apps/
├── api/src/
│   ├── main.ts, app.module.ts
│   ├── config/          # env loader
│   ├── common/          # guards, filters, Redis
│   └── modules/         # auth, users, payments, AI
├── api/test/            # API e2e
└── web/src/
    ├── app/[locale]/    # routes and layouts
    ├── entities/        # domain state
    ├── features/        # user actions
    ├── widgets/         # composed UI
    ├── shared/          # API, UI, config
    └── i18n/            # locale routing
packages/
└── types/src/           # shared contracts
docs/
├── architecture/        # auth and payments
├── conventions/         # source-of-truth rules
├── testing/             # test plans
└── vision/              # agency product context
```

## Domain Model

### User

Файл: `apps/api/src/modules/users/schemas/user.schema.ts` | Zod: `packages/types/src/entities/user.ts`

- Містить embedded `profile`, `executions`, `ai` і nullable `billing`; видалення — soft-delete з відкладеним очищенням.
- `activeReservation` зберігає компенсаційні `$inc`-операції для безпечного refund.
- Sparse indexes покривають provider/billing IDs та строк завершення reservation.

### ExecutionTransaction

Файл: `apps/api/src/modules/users/schemas/execution-transaction.schema.ts` | Контракт: `packages/types/src/contracts/executions.ts`

- Ledger для credit/debit змін executions; історія читається через compound index `(userId, createdAt desc)`.
- `reservationId` має unique sparse index і захищає commit від повтору.

### ChatMessage

Файл: `apps/api/src/modules/ai/schemas/chat-message.schema.ts` | Zod: `packages/types/src/contracts/ai-chat.ts`

- Повідомлення належать користувачу; історія впорядковується compound index `(userId, createdAt)`.
- Пара user/assistant записується в тій самій MongoDB transaction, що й commit execution reservation.

### Brief

Файл: `apps/api/src/modules/agency/schemas/brief.schema.ts` | Zod: `packages/types/src/agency/brief.ts`

- Може бути анонімним або прив'язаним до `userId`; authenticated flow одноразово надає AI bonus.
- `status` індексований; source і locale зберігаються разом із заявкою.

### ProcessedWebhookEvent

Файл: `apps/api/src/modules/payments/schemas/processed-webhook-event.schema.ts`

- Unique `(provider, providerEventId)` забезпечує idempotency.
- Двофазний стан `pending → applied`; невдала обробка видаляє `pending` для безпечного retry.

### OrphanedProviderCustomer

Файл: `apps/api/src/modules/payments/schemas/orphaned-provider-customer.schema.ts`

- Черга повторного видалення provider customer після невдалого account cleanup.
- Unique provider/customer index; cron припиняє спроби після п'яти помилок.

## Module Dependency Map

- `AuthModule ↔ UsersModule` через `forwardRef`; `AuthModule → StorageModule → UsersModule` розширює цей цикл.
- `PaymentsModule → UsersModule`.
- `AiModule → UsersModule`.
- `AgencyModule → UsersModule`; email доступний через global `EmailModule`.
- `StorageModule → UsersModule` і експортує `StorageService` для OAuth avatar flow.
- `RedisModule` та `EmailModule` — global; `ReportsModule` ізольований.
- Web: `app → widgets/features/entities → shared`; `shared` не імпортує вищі FSD-шари.
- Agency може імпортувати Core, але не навпаки; виняток лише `apps/web/src/app/overlays.tsx`.

## Key Patterns

### Endpoint і відповіді

Controller використовує DTO, guard, `@CurrentUser()` і service; успішна відповідь зазвичай має `{ data: ... }`. Приклад: `apps/api/src/modules/payments/payments.controller.ts`. Помилки нормалізує `apps/api/src/common/filters/all-exceptions.filter.ts`.

### Shared validation

Zod schema живе в `packages/types`, API DTO обгортає її через `createZodDto()`, web-форми використовують `zodResolver`. Приклад: `apps/api/src/modules/payments/dto/create-checkout-session.dto.ts`.

### Auth і onboarding

Основний guard — `JwtActiveGuard`; `JwtAuthGuard` дозволений для restore soft-deleted account, `SubscriptionGuard` — для платного доступу. Глобальний `OnboardingInterceptor` пропускають лише через `@SkipOnboarding()`. Повний flow: `docs/architecture/auth-flow/`.

### Payments

Stripe адаптований через provider token; catalog читається зі Stripe, перевіряється на старті й кешується в Redis на 5 хвилин. Webhook idempotency та out-of-order правила: `docs/architecture/payments-flow/`.

### Executions і reservation

Мутації балансу атомарні. Довгі операції спочатку reserve, потім викликають generic `UsersService.commitReservation()` або `refundReservation()`; expired reservations повертає cron. Приклад: `apps/api/src/modules/ai/ai.service.ts`.

### Frontend auth

Access token зберігається в пам'яті, refresh token — у `bid_refresh` httpOnly cookie. Axios дедуплікує паралельний refresh; `authEvents` розриває залежність `shared/api → entities`. Файли: `apps/web/src/shared/api/client.ts`, `apps/web/src/entities/user/authStore.ts`.

### Cross-slice UI

Overlay state живе в owning slice, усі overlay монтуються один раз у `apps/web/src/app/overlays.tsx`. Cross-module команди передаються через `apps/web/src/shared/lib/uiIntents.ts`. Деталі: `docs/conventions/overlays.md`.

### Storage

Avatar flow: presigned PUT напряму в R2, потім server-side commit з `HeadObject`; API не проксує upload. Контракти: `packages/types/src/contracts/storage.ts`, реалізація: `apps/api/src/modules/storage/storage.service.ts`.

### Локалізація помилок

API повертає англомовний developer message і machine-readable code; web мапить code на `messages/{locale}.json`. Джерела: `docs/conventions/i18n.md`, `apps/web/src/shared/api/mapApiCode.ts`.

## API Overview

Global prefix: `/api`. `JAA` = `JwtActiveGuard`, `JA` = `JwtAuthGuard`, `ARL` = `AiRateLimitGuard`.

| Модуль | Метод і шлях | Guard | Призначення |
| --- | --- | --- | --- |
| App | `GET /`, `GET /health` | — | root і healthcheck |
| Auth | `GET /auth/google`, `GET /auth/google/callback` | Google Passport | OAuth redirect/callback |
| Auth | `POST /auth/check-email` | — | визначити login flow |
| Auth | `POST /auth/login/password` | — | password login |
| Auth | `POST /auth/magic-link/send`, `/verify` | — | magic-link lifecycle |
| Auth | `POST /auth/password/reset` | — | reset за token |
| Auth | `POST /auth/password/set`, `/change`, `/verify` | JAA | password management |
| Auth | `POST /auth/refresh`, `/logout` | cookie | rotate/revoke refresh token |
| Users | `GET/PATCH /users/me` | JAA | profile state/update |
| Users | `PATCH /users/me/lang` | JAA | preferred locale |
| Users | `POST /users/me/accept-terms` | JAA | terms acceptance |
| Users | `POST /users/me/executions/spend` | JAA | atomic debit |
| Users | `GET /users/me/executions/transactions` | JAA | paginated ledger |
| Users | `POST /users/account/delete` | JAA | start deletion |
| Users | `POST /users/account/delete/confirm` | JAA | soft-delete account |
| Users | `POST /users/account/restore` | JA | restore account |
| Payments | `GET /payments/catalog` | — | public catalog |
| Payments | `POST /payments/checkout-session` | JAA | Stripe checkout |
| Payments | `POST /payments/portal-session` | JAA | billing portal |
| Payments | `POST /payments/reset` | JAA | clear billing state |
| Payments | `POST /payments/webhook/:provider` | signature | provider webhook |
| AI | `POST /ai/chat` | JAA + ARL | SSE chat stream |
| AI | `GET/DELETE /ai/chat/history` | JAA | read/clear history |
| Storage | `POST /storage/avatar/upload-url` | JAA | presigned upload URL |
| Storage | `POST /storage/avatar/commit` | JAA | verify and attach |
| Storage | `DELETE /storage/avatar` | JAA | remove avatar |
| Agency | `POST /agency/brief` | Turnstile | anonymous brief |
| Agency | `POST /agency/brief/authenticated` | JAA + Turnstile | brief with AI bonus |

`ReportsController` не має endpoint. Global throttling — 60 requests/60s; catalog і webhook його пропускають.

## Configuration & Environment

Єдине локальне джерело — root `.env`; приклад — `.env.example`. API читає його через `apps/api/src/config/env.ts`, web build — через `apps/web/next.config.ts` і `apps/web/src/shared/config/env.ts`.

**API required, старт падає без значення:** `NODE_ENV`, `API_PORT`, `WEB_URL`, `MONGODB_URI`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `BRIEF_NOTIFICATION_EMAIL`, `ANTHROPIC_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

**Web/Compose:** `WEB_PORT` потрібен Compose; `NEXT_PUBLIC_TURNSTILE_SITE_KEY` обов'язковий для web build. `WEB_URL`, `R2_PUBLIC_URL` і `API_INTERNAL_URL` обов'язкові; перші два інлайняться як `NEXT_PUBLIC_BASE_URL` і `NEXT_PUBLIC_STORAGE_URL` — не додавай їх дублікати в `.env`. Усі три мусять бути HTTP(S) origin без path і trailing slash (`requireOrigin` у `next.config.ts` валить build інакше).

**Optional:** `NEXT_PUBLIC_DEMO_VIDEO_PATH` і `NEXT_PUBLIC_DEMO_VIDEO_POSTER_PATH` вмикають demo video; poster без video зупиняє build.

Feature flags і продуктові ліміти не є env: спільні значення живуть у `packages/types/src/constants/`, локальні — біля модуля. Payment toggles: `packages/types/src/constants/payments.ts`. Будь-яку нову env синхронізуй між loader, `.env.example`, test setup і Docker за `docs/conventions/fail-fast.md`; fallback для required env заборонений.

## Common Commands

- `pnpm dev` — усі dev tasks через Turborepo.
- `pnpm build` — повна збірка з dependency order.
- `pnpm lint` — ESLint усіх workspace.
- `pnpm format` — Prettier для репозиторію.
- `pnpm test` — workspace unit tests.
- `pnpm --filter api test` — API unit tests.
- `pnpm --filter api test:e2e` — API e2e.
- `pnpm --filter api test:cov` — API coverage.
- `pnpm --filter web test` — web unit tests.
- `pnpm --filter @cyanship/types build` — shared package.
- `docker compose -f docker-compose.dev.yml up --build` — local stack.
- `docker compose -f docker-compose.dev.yml down` — зупинити local stack.

## Testing Strategy

Jest unit tests лежать поруч із кодом як `*.spec.ts(x)`; API e2e — у `apps/api/test/*.e2e-spec.ts`. Unit tests ізолюють services/providers, e2e піднімають реальний Nest graph на MongoMemoryServer; AI e2e використовує `MongoMemoryReplSet` через transactions. CI (`.github/workflows/ci.yml`) на `main` виконує lint, build, API unit та e2e. Детальні матриці: `docs/testing/auth/` і `docs/testing/payments/`.

## Rules & Conventions

<!-- MANUAL:START -->
- `docs/conventions/` — єдине джерело правил; не дублюй деталі в agent-файлах.
- Зберігай напрям залежностей `Agency → Core`; Core не імпортує Agency. `shared` — найнижчий FSD-шар, глобального `src/stores/` немає. Межі описані в `docs/conventions/modular-boundaries.md` і enforced ESLint.
- Shared API shapes і validation живуть у `packages/types`; не дублюй backend/frontend типи. Нові response codes реєструй і локалізуй за `docs/conventions/i18n.md`.
- У frontend використовуй наявні `Ui*` primitives, design tokens і mobile-first layout. Правила: `docs/conventions/ui-primitives.md`, `design-tokens.md`, `responsive.md`.
- Overlay керується Zustand store у owning slice і монтується в `app/overlays.tsx`; вкладені overlay заборонені. Форми не блокують submit через невалідність — показують причину. Дивись `overlays.md` і `forms.md`.
- User-facing тексти завжди через `messages/uk.json` та `messages/en.json`, формальне «ви», без emoji й окликів у success. Дивись `docs/conventions/tone.md`.
- Пиши strict TypeScript; уникай `any`, подвійних cast, `@ts-ignore`, неатомарних read-then-write і проковтнутих помилок.
- При додаванні user-facing поля в `User` онови privacy policy: `apps/web/src/app/[locale]/(agency)/privacy/page.tsx`.
- Тести називай `*.spec.ts(x)`; API e2e — `*.e2e-spec.ts`. Перед PR запускай тести й lint зміненого workspace; для UI додай screenshots і перевір mobile/tablet/desktop.
- Commit subjects зазвичай використовують Conventional Commits: `feat(web): ...`, `fix(api): ...`, `refactor: ...`, `chore(infra): ...`.
<!-- MANUAL:END -->

## Known Complexities

- Stripe signature перевіряється лише по сирому body. Не прибирай `rawBody: true` з `apps/api/src/main.ts` і не парсь webhook body до `StripeService`.
- MongoDB transactions потрібні для atomic reservation commit і запису chat history. Production MongoDB мусить працювати як replica set; AI e2e тому використовує `MongoMemoryReplSet`.
- `packages/types` має бути зібраний раніше за API/web у Docker. Turborepo робить це через `dependsOn: ["^build"]`; Dockerfile викликає build shared package явно.
- Refresh cookie вимагає same-origin `/api`. `API_BASE_PATH` навмисно константа, а `API_INTERNAL_URL` задає внутрішній Next.js proxy target — і тому обов'язковий: без rewrite браузер не має жодного шляху до API.
- AI stream слухає `close` на response, не request. До першого token disconnect повертає reservation; після першого token запит оплачується і commit виконується без відповіді клієнту. Файл: `apps/api/src/modules/ai/ai.controller.ts`.
- Presigned R2 PUT не обмежує максимальний розмір; size/type перевіряються під час commit через metadata, а не довірою до клієнта. HEIC свідомо не підтримується через ліцензійну залежність libheif; причина в `packages/types/src/constants/storage.ts`.
- `CatalogService` прогріває Stripe catalog на старті й падає при недоступному або некоректному catalog. Це навмисний fail-fast, а не необов'язковий warm-up.
- `AuthModule ↔ UsersModule` — свідомий circular dependency через `forwardRef`; зміни imports перевіряй повною Nest build/e2e, а не лише unit mocks.
