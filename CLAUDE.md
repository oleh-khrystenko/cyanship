# LucidKit

> Production-ready SaaS boilerplate — все, що потрібно для швидкого запуску web-додатка: auth, payments, i18n, theming та модульна архітектура з коробки.

<!-- MANUAL:START -->
# Rules

- Before making ANY code changes, read the relevant module's files to understand current implementation
- Always check prisma/schema.prisma before modifying data layer
- Always check existing patterns in similar modules before creating new ones

## Project Conventions (MANDATORY)

All AI agents MUST read and follow rules in `docs/conventions/`:

- **[Tone & Style](docs/conventions/tone.md)** — tone and style for all user-facing messages (toasts, errors, confirmations)
- **[Fail Fast](docs/conventions/fail-fast.md)** — required env vars policy, no silent fallbacks
- **[Env Sync](docs/conventions/env-sync.md)** — always update env.ts, .env, and .env.example together

Full index: [docs/conventions/README.md](docs/conventions/README.md)
  <!-- MANUAL:END -->

## Tech Stack

| Шар            | Технологія                    | Версія                                |
| -------------- | ----------------------------- | ------------------------------------- |
| Monorepo       | Turborepo + pnpm workspaces   | turbo 2.5.8, pnpm 10.30.1             |
| Frontend       | Next.js (App Router) + React  | 16.0.1, React 19.2                    |
| Backend        | NestJS + Express              | 11.1.8                                |
| БД             | MongoDB + Mongoose            | mongoose 8.19.2                       |
| Мова           | TypeScript (strict mode)      | 5.9.3                                 |
| Styling        | TailwindCSS 4.x + CVA        | 4.1.16                                |
| State          | Zustand                       | 5.0.11                                |
| i18n           | next-intl                     | 4.4.0                                 |
| Theme          | next-themes                   | 0.4.6                                 |
| Auth           | Passport + JWT + Google OAuth + bcrypt | passport 0.7, @nestjs/jwt 11.0, bcrypt 6.0 |
| Validation     | Zod + nestjs-zod              | zod 4.3.6, nestjs-zod 5.1.1           |
| Email          | Resend                        | 6.9.2                                 |
| Payments       | Stripe                        | stripe 20.4.0 (API v2026-02-25.clover) |
| Cache          | Redis (ioredis)               | 5.9.3                                 |
| Scheduler      | @nestjs/schedule              | 6.1.1                                 |
| HTTP client    | Axios                         | 1.13.5                                |
| UI примітиви   | Headless UI, Radix            | headlessui 2.2.9, radix-tooltip 1.2.8 |
| Icons          | lucide-react                  | 0.564.0                               |
| Toasts         | Sonner                        | 2.0.7                                 |
| Тести          | Jest + Supertest              | jest 30.2, supertest 7.1.4            |
| Компілятор API | SWC                           | 1.13.5                                |

## Architecture Overview

Turborepo monorepo з 2 apps + 1 shared package. Auth (Google OAuth + Magic Link + Password) повністю реалізований, включно з profile management, account soft-deletion з 30-day grace period, brute force protection. Payments (Stripe subscription + one-off credit packs + webhooks + billing portal) повністю реалізований. Reports, Storage -- skeleton.

- **apps/api** -- NestJS REST API, модульна архітектура, MongoDB через Mongoose, JWT auth, Redis для magic links, token storage, rate limiting, brute force tracking, Stripe webhooks (subscriptions + one-off)
- **apps/web** -- Next.js SSR/CSR з Feature-Sliced Design, i18n, light/dark/system theme (next-themes), auth pages, profile management, billing page (subscriptions + credit packs). Dev: `next dev --turbopack`. Build: `output: 'standalone'` (Docker). API proxy: `/api/*` -> backend via `next.config.ts` rewrites.
- **packages/types** -- Shared Zod-схеми, типи, constants, contracts, validation, enums. Entry: `src/index.ts` -> 5 modules (constants, enums, entities, contracts, validation). Build: CJS to `dist/` via `tsconfig.build.json`.

## Project Structure

```
lucidkit/
├── apps/
│   ├── api/                              # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts                   # Bootstrap: cookie-parser, rawBody:true, ZodValidationPipe, AllExceptionsFilter, CORS
│   │   │   ├── app.module.ts             # Root: Config, Throttler(60/60s), ScheduleModule, Mongoose, feature modules
│   │   │   ├── app.controller.ts         # GET / (hello), GET /health
│   │   │   ├── app.service.ts            # getHello() -> "Hello World!"
│   │   │   ├── config/env.ts             # Fail-fast ENV object + parseLockoutThresholds() + STRIPE_CREDIT_PACKS
│   │   │   ├── common/
│   │   │   │   ├── decorators/current-user.decorator.ts  # @CurrentUser() -> request.user
│   │   │   │   ├── filters/all-exceptions.filter.ts      # Global error handler -> { error: { code, message } }
│   │   │   │   ├── guards/jwt-auth.guard.ts              # AuthGuard('jwt')
│   │   │   │   ├── guards/jwt-active.guard.ts            # Extends JwtAuthGuard + rejects soft-deleted users (deletedAt !== null)
│   │   │   │   ├── guards/subscription.guard.ts          # CanActivate: user.billing?.hasActiveSubscription
│   │   │   │   └── providers/redis.provider.ts           # REDIS_CLIENT token (ioredis)
│   │   │   └── modules/
│   │   │       ├── auth/                 # ✅ Повністю реалізований
│   │   │       │   ├── auth.module.ts    # PassportModule, JwtModule(1h), UsersModule(forwardRef), OnModuleInit(ping Redis), OnModuleDestroy(close Redis)
│   │   │       │   ├── auth.controller.ts # 12 endpoints: Google OAuth, magic-link, password, refresh, logout
│   │   │       │   ├── auth.service.ts   # Tokens, magic links, rate limiting, brute force, password, rotation
│   │   │       │   ├── services/email.service.ts          # Resend: 4 email templates × 2 langs (HTML with LucidKit branding)
│   │   │       │   ├── strategies/jwt.strategy.ts         # fromAuthHeaderAsBearerToken -> findById
│   │   │       │   ├── strategies/google.strategy.ts      # scope:[email,profile], state:false, verifies email
│   │   │       │   └── dto/              # 7 Zod DTOs (check-email, send-magic-link, login-password, set/change/verify-password, verify-magic-link)
│   │   │       ├── users/                # ✅ Повністю реалізований
│   │   │       │   ├── users.module.ts
│   │   │       │   ├── users.controller.ts  # 6 endpoints: getMe, updateProfile, updateLang, deleteAccount, confirmDelete, restore
│   │   │       │   ├── users.service.ts     # CRUD, findOrCreate, profile, soft-delete, restore, credits (addCredits, deductCredit, hasCredit)
│   │   │       │   ├── cleanup.service.ts   # @Cron(EVERY_DAY_AT_3AM) hard-delete expired accounts + revokeAllUserTokens
│   │   │       │   ├── schemas/user.schema.ts  # Mongoose: email, provider, profile, credits, passwordHash, deletedAt, accountDeletionRequestedAt, billing
│   │   │       │   └── dto/              # update-profile.dto.ts, update-lang.dto.ts
│   │   │       ├── payments/             # ✅ Повністю реалізований (subscription + one-off)
│   │   │       │   ├── payments.module.ts
│   │   │       │   ├── payments.controller.ts  # 3 endpoints: checkout-session, portal-session, webhook/:provider
│   │   │       │   ├── payments.service.ts     # Checkout (sub + one-off), portal, two-phase webhook idempotency, WEBHOOK_MONGO_TIMEOUT_MS=10000
│   │   │       │   ├── providers/
│   │   │       │   │   ├── stripe.service.ts           # IPaymentProvider impl, 4 event types, apiVersion: '2026-02-25.clover'
│   │   │       │   │   └── payment-provider.provider.ts # DI factory -> StripeService
│   │   │       │   ├── interfaces/payment-provider.interface.ts  # PAYMENT_PROVIDER token + interface
│   │   │       │   ├── schemas/processed-webhook-event.schema.ts # Two-phase idempotency (pending -> applied), timestamps:false
│   │   │       │   └── dto/create-checkout-session.dto.ts
│   │   │       ├── reports/              # 🟡 Skeleton (empty controller + service)
│   │   │       └── storage/              # 🟡 Skeleton (no controller, service only)
│   │   ├── src/test-setup.ts             # Sets minimal Stripe env for unit tests (fail-fast policy)
│   │   └── test/
│   │       ├── app.e2e-spec.ts           # E2E: basic endpoints, invalid auth, 401 flows
│   │       ├── auth.e2e-spec.ts          # E2E: MongoMemoryServer + stateful Redis mock (~600 lines)
│   │       ├── payments.e2e-spec.ts      # E2E: Full payments flow + webhook simulation (~600 lines)
│   │       └── jest-e2e.json
│   │
│   └── web/                              # Next.js frontend
│       ├── next.config.ts                # standalone output, /api/* proxy to backend, Google images allowed
│       ├── postcss.config.mjs            # @tailwindcss/postcss
│       ├── src/
│       │   ├── app/
│       │   │   ├── providers.tsx         # next-themes ThemeProvider (attribute:class, storageKey:theme, defaultTheme:system)
│       │   │   ├── globals.css           # @import tailwindcss + 4 style files
│       │   │   └── [locale]/
│       │   │       ├── layout.tsx        # Providers, NextIntlClientProvider, AuthInitializer, Header, Mulish font (Cyrillic+Latin)
│       │   │       ├── page.tsx          # Welcome page (public), SEO via fetchMetadata()
│       │   │       ├── auth/
│       │   │       │   ├── signin/page.tsx   # Email -> password/magic-link decision (450 lines, 6-state machine)
│       │   │       │   ├── callback/page.tsx # OAuth callback: refreshToken -> getMe -> /profile; handles ?account_deleted=true
│       │   │       │   └── verify/page.tsx   # Magic link verification (Suspense, 4 purposes, 4 status states)
│       │   │       └── (protected)/
│       │   │           ├── layout.tsx        # AuthGuard wrapper
│       │   │           ├── profile/page.tsx  # Profile (form, security, danger zone); ?mode=new|set-password|reset-password
│       │   │           └── billing/
│       │   │               ├── page.tsx      # Subscription + credit packs UI (feature flags control visibility)
│       │   │               ├── layout.tsx    # SEO metadata
│       │   │               ├── success/page.tsx  # Post-checkout: getMe -> update store -> toast -> /billing
│       │   │               └── cancel/page.tsx   # Cancel: toast -> /billing
│       │   ├── entities/brand/Logo.tsx   # "LucidKit" text logo (text-5xl, bold, primary)
│       │   ├── features/
│       │   │   ├── auth/                 # AuthInitializer (silent refresh, skips /auth/callback & /auth/verify), AuthGuard
│       │   │   ├── change-lang/          # Language switcher (country-flag-icons, UiSelect, updates URL + backend pref)
│       │   │   ├── change-theme/         # Theme toggle (3 modes: Light/System/Dark, lucide icons)
│       │   │   └── profile/              # ProfileForm (name/avatar/lang), SecuritySection (set/change/delete pwd), DangerZone (60s cooldown), DeleteAccountModal
│       │   ├── widgets/header/           # Sticky header: Logo + avatar/initials + credits badge + theme + lang + logout
│       │   ├── shared/
│       │   │   ├── api/
│       │   │   │   ├── client.ts         # Axios + 401 auto-refresh interceptor + in-memory token (closure)
│       │   │   │   ├── auth.ts           # 16 auth API functions
│       │   │   │   ├── payments.ts       # createSubscriptionCheckout, createOneOffCheckout, createPortalSession
│       │   │   │   ├── mapApiCode.ts     # ResponseCode -> i18n key mapping (notifications.{module}.{code} -> errors.generic.unknown)
│       │   │   │   └── index.ts
│       │   │   ├── config/env.ts         # Fail-fast ENV + payment feature flags
│       │   │   ├── ui/                   # UiButton (polymorphic: button/link/a), UiInput (outlined/filled), UiSelect (Headless Listbox), UiSwitch, UiSpinner
│       │   │   ├── lib/utils.ts          # composeClasses() helper
│       │   │   ├── icons/GoogleIcon.tsx   # Google OAuth SVG icon (official colors)
│       │   │   ├── seo/metadata.ts       # fetchMetadata(): canonical URLs, hrefLang alternates (x-default, uk-ua, en-ua)
│       │   │   ├── types/settings.ts     # THEME enum, Theme, PageParams, MetaProps
│       │   │   └── styles/              # themes.css (CSS vars light/dark), settings.css (.container), custom-variants.css, animations.css, scrollbar.css
│       │   ├── stores/auth/authStore.ts  # user, isAuthenticated, isLoading (Zustand, initial isLoading=true)
│       │   ├── i18n/                     # routing.ts (locales:['uk','en'], default:'uk'), request.ts (server-side config)
│       │   └── middleware.ts             # Protects /profile,/pay,/billing; redirects /auth/signin if authenticated; i18n routing
│       └── messages/                     # uk.json, en.json (namespaces: welcome_page, auth_page, notifications, errors, profile_page, billing_page, components)
│
├── packages/
│   └── types/                            # @lucidkit/types
│       └── src/
│           ├── index.ts                  # Re-exports all 5 modules
│           ├── constants/lang.ts         # LANG { UK:'uk', EN:'en' }, Lang type
│           ├── enums/
│           │   ├── response-code.ts      # PRIMARY: RESPONSE_CODE (17 codes), RESPONSE_CODE_TYPE mapping
│           │   ├── response-type.ts      # RESPONSE_TYPE { SUCCESS, ERROR }
│           │   └── error-code.ts         # DEPRECATED: backward compat alias to RESPONSE_CODE
│           ├── entities/user.ts          # UserSchema (з billing, credits, hasPassword, accountDeletionRequestedAt), UserProfileSchema
│           ├── contracts/
│           │   ├── api.ts               # ApiErrorSchema, ApiResponse<T>, ApiMessageResponse
│           │   ├── auth.ts              # MAGIC_LINK_PURPOSE (4), 10 schemas (SendMagicLink, VerifyMagicLink, AuthResponse, CheckEmail, LoginPassword, Set/Change/VerifyPassword, DeleteAccountVerifyResponse)
│           │   ├── payments.ts          # PAYMENT_TYPE, CREDIT_PACK_CONFIG, SUBSCRIPTION_STATUS (7), BILLING_EVENT_TYPE (4), CreateCheckoutSessionSchema (discriminated union), UserBillingSchema, BillingWebhookEventSchema
│           │   └── users.ts             # UpdateLangSchema, UpdateProfileSchema
│           └── validation/common.ts      # emailSchema, passwordSchema (min 8), objectIdSchema (24 hex)
│
├── docs/
│   ├── conventions/                      # tone.md, fail-fast.md, i18n.md, env-sync.md
│   ├── planning/                         # auth-flow/ (17 docs), payments-mvp-implementation-blueprint.md
│   └── sprints/                          # sprint-003 through sprint-008 (auth -> payments testing)
├── docker-compose.yml                    # Prod: api + web
├── docker-compose.dev.yml                # Dev: mongo:7 + redis:7-alpine + api + web (types build first)
├── turbo.json                            # Pipeline: dev(no cache), build(^build deps), lint, test(no cache)
├── tsconfig.json                         # Root: ES2020, strict, project references
├── .prettierrc                           # singleQuote, tabWidth:4, trailingComma:es5, printWidth:80; web override: prettier-plugin-tailwindcss
└── pnpm-workspace.yaml                   # apps/*, packages/*
```

## Domain Model

### User (реалізований)

Файл: `apps/api/src/modules/users/schemas/user.schema.ts`
Zod: `packages/types/src/entities/user.ts`

| Поле                          | Тип                                      | Опис                         |
| ----------------------------- | ---------------------------------------- | ---------------------------- |
| email                         | string (unique, lowercase, trim)         | Email користувача            |
| provider                      | `{ name, id }` (optional, sparse index)  | OAuth провайдер (google)     |
| profile                       | `{ name?, avatar? }` (default: {})       | Профіль                      |
| credits                       | `{ balance: int>=0, freeReportUsed: bool }` | Кредити (default: 0, false) |
| passwordHash                  | string \| null                           | bcrypt hash пароля           |
| deletedAt                     | Date \| null                             | Soft-delete timestamp        |
| accountDeletionRequestedAt    | Date \| null                             | Коли запитано видалення      |
| preferredLang                 | string                                   | Мова (default: 'uk')        |
| lastLoginAt                   | Date (optional)                          | Останній логін               |
| billing                       | BillingInfo \| null                      | Дані підписки Stripe         |
| createdAt, updatedAt          | Date                                     | Timestamps (auto)            |

**billing поля:** provider, providerCustomerId, providerSubscriptionId, planCode, currency, subscriptionStatus, providerSubscriptionStatus, currentPeriodEnd, cancelAtPeriodEnd, hasActiveSubscription, lastProviderEventAt

**Індекси:** `{ email: 1 }` (unique), `{ 'provider.id': 1 }` (sparse), `{ 'billing.providerCustomerId': 1 }` (sparse), `{ 'billing.providerSubscriptionId': 1 }` (sparse)

**Zod UserSchema** (packages/types): Includes `hasPassword` (boolean, derived -- actual passwordHash never exposed), `accountDeletionRequestedAt` (Date | null). `UserProfileSchema` -- subset for client responses (picked fields).

**Credits operations** (`users.service.ts`):
- `addCredits(userId, amount)` -- atomic `$inc` on `credits.balance`
- `deductCredit(userId)` -- paid credit first (`$gt: 0`), fallback to free report
- `hasCredit(userId)` -- balance > 0 OR !freeReportUsed

### ProcessedWebhookEvent (реалізований)

Файл: `apps/api/src/modules/payments/schemas/processed-webhook-event.schema.ts`

| Поле           | Тип                       | Опис                           |
| -------------- | -------------------------- | ------------------------------ |
| provider       | string                     | 'stripe'                       |
| providerEventId| string                     | Stripe event ID                |
| receivedAt     | Date                       | Коли отримано                  |
| occurredAt     | Date                       | Коли сталося (Stripe timestamp)|
| type           | string                     | BILLING_EVENT_TYPE (4 values)  |
| userId         | string \| null             | ID користувача                 |
| packCode       | string \| null             | Для one-off payments           |
| status         | 'pending' \| 'applied'     | Two-phase idempotency state    |

**Унікальний індекс:** `{ provider: 1, providerEventId: 1 }` -- для idempotency. `timestamps: false` (custom receivedAt/occurredAt).

### Redis Keys (тимчасові)

| Ключ                                | Значення                        | TTL        | Призначення                      |
| ----------------------------------- | ------------------------------- | ---------- | -------------------------------- |
| `magic:{token64}`                   | `{email, purpose}` JSON         | 15 min     | Magic link token                 |
| `magic_dedup:{email}:{purpose}`     | token                           | 60s        | Dedup same email+purpose         |
| `ratelimit:magic:{email}`           | count                           | 15 min     | Rate limit лічильник (3/15min)   |
| `check_email:{ip}`                  | count                           | 60s        | Check-email rate limit (10/60s)  |
| `login_attempts:{ip}:{email}`       | count                           | 15 min     | Brute force tracking             |
| `refresh:{jti}`                     | userId / "rotated"              | 7d / 10s   | Refresh token storage            |
| `refresh_family:{userId}`           | Set[jti]                        | 7 days     | Token family для reuse detection |

### Типи в packages/types

| Модуль                   | Зміст                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `constants/lang.ts`      | `LANG` object (as const), `Lang` type                                              |
| `enums/error-code.ts`    | DEPRECATED. Kept for AllExceptionsFilter backward compat                           |
| `enums/response-code.ts` | Primary. `RESPONSE_CODE` (17 codes): auth/users success, payments errors, generic errors. `RESPONSE_CODE_TYPE` mapping |
| `enums/response-type.ts` | `RESPONSE_TYPE = { SUCCESS, ERROR }`, `ResponseType` type                          |
| `entities/user.ts`       | `UserSchema` з billing + hasPassword + accountDeletionRequestedAt, `UserProfileSchema`, `UserCreditsSchema` |
| `contracts/api.ts`       | `ApiErrorSchema`, `ApiResponse<T>`, `ApiMessageResponse`                           |
| `contracts/auth.ts`      | `MAGIC_LINK_PURPOSE` (4 values: LOGIN, REGISTER, RESET_PASSWORD, DELETE_ACCOUNT), 10 schemas |
| `contracts/payments.ts`  | `PAYMENT_TYPE` (SUBSCRIPTION, ONE_OFF), `CREDIT_PACK_CONFIG` (credits_5/10/20), `SUBSCRIPTION_STATUS` (7), `BILLING_EVENT_TYPE` (4), `CreateCheckoutSessionSchema` (discriminated union), `UserBillingSchema`, `BillingWebhookEventSchema` |
| `contracts/users.ts`     | `UpdateLangSchema`, `UpdateProfileSchema`                                          |
| `validation/common.ts`   | `emailSchema`, `passwordSchema` (min 8), `objectIdSchema` (24 hex)                |

## Module Dependency Map

### Backend (apps/api)

```
AppModule (root)
├── ConfigModule.forRoot({ isGlobal: true })
├── ThrottlerModule.forRoot({ limit: 60, ttl: 60000 }) + ThrottlerGuard (APP_GUARD)
├── ScheduleModule.forRoot()
├── MongooseModule.forRoot(ENV.MONGODB_URI)
├── AuthModule
│   ├── PassportModule
│   ├── JwtModule (JWT_ACCESS_SECRET, 1h)
│   ├── UsersModule (forwardRef)
│   ├── Providers: [AuthService, EmailService, JwtStrategy, GoogleStrategy, redisProvider]
│   ├── Exports: [AuthService, EmailService, REDIS_CLIENT]
│   └── Lifecycle: OnModuleInit (ping Redis), OnModuleDestroy (close Redis)
├── UsersModule
│   ├── MongooseModule.forFeature(User)
│   ├── AuthModule (forwardRef -- circular)
│   ├── Providers: [UsersService, CleanupService]
│   └── Exports: [UsersService, MongooseModule]
├── PaymentsModule
│   ├── MongooseModule.forFeature(ProcessedWebhookEvent)
│   ├── UsersModule
│   ├── Providers: [PaymentsService, StripeService, paymentProviderProvider]
│   └── Exports: [PaymentsService]
├── ReportsModule -- skeleton
└── StorageModule -- skeleton
```

**Крос-модульні залежності:**
- `AuthModule` -> `UsersModule` (findOrCreate users)
- `UsersModule` -> `AuthModule` (sendMagicLink, verifyPassword, revokeAllUserTokens)
- `PaymentsModule` -> `UsersModule` (findById for billing updates, addCredits for one-off)

### Frontend (apps/web)

```
layout.tsx ([locale])
├── Providers (next-themes ThemeProvider)
├── NextIntlClientProvider (i18n)
├── AuthInitializer (silent token refresh, skips /auth/callback & /auth/verify)
├── Header -> Logo, avatar/initials, credits badge, Logout, ChangeTheme(dynamic ssr:false), ChangeLang
└── {children} -- pages

middleware.ts
├── i18n (createIntlMiddleware)
├── Protected: /profile, /pay, /billing -> redirect if no bid_refresh cookie
└── Auth: /auth/signin -> redirect to /profile if bid_refresh exists
```

## Key Patterns

### Створення нового API endpoint

Файл: `apps/api/src/modules/payments/payments.controller.ts`

```typescript
@Post('checkout-session')
@UseGuards(JwtActiveGuard)
async createCheckoutSession(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateCheckoutSessionDto,
): Promise<{ data: { checkoutUrl: string } }> {
    const { checkoutUrl } = await this.paymentsService.createCheckoutSession(
        user._id.toString(), dto,
    );
    return { data: { checkoutUrl } };
}
```

### Валідація (Zod)

Файл: `apps/api/src/modules/payments/dto/create-checkout-session.dto.ts`

```typescript
export class CreateCheckoutSessionDto extends createZodDto(CreateCheckoutSessionSchema) {}
```

Схеми в `@lucidkit/types`, DTOs через `createZodDto()` з `nestjs-zod`.

### Авторизація (Guards)

```typescript
// Базова JWT авторизація (дозволяє soft-deleted users)
@UseGuards(JwtAuthGuard)
@Post('account/restore')

// JWT + перевірка що акаунт не видалений (основний guard для більшості endpoints)
@UseGuards(JwtActiveGuard)
@Get('me')
getMe(@CurrentUser() user: UserDocument) { ... }

// JWT + активна підписка (для платного контенту)
@UseGuards(JwtAuthGuard, SubscriptionGuard)
```

`JwtActiveGuard` -- extends JwtAuthGuard, overrides `handleRequest()` для reject soft-deleted users (`deletedAt !== null`). Файл: `apps/api/src/common/guards/jwt-active.guard.ts`

`SubscriptionGuard` -- перевіряє `user.billing?.hasActiveSubscription === true`, throws ForbiddenException з кодом `SUBSCRIPTION_REQUIRED`. Файл: `apps/api/src/common/guards/subscription.guard.ts`

### Webhook обробка (two-phase idempotency)

Файл: `apps/api/src/modules/payments/payments.service.ts`

1. Перевірка підпису через `IPaymentProvider.handleWebhookPayload(rawBody, signatureHeader)`
2. `resolveUserId(event)` -- з metadata або lookup по providerSubscriptionId
3. **Phase 1**: Insert як `'pending'` -> duplicate key 11000 -> check existing status (applied=skip, pending=retry)
4. **Phase 2**: Process event (subscription: atomic billing update, one-off: atomic `addCredits`)
5. **Phase 3**: Mark `'applied'` on success; on failure: rollback pending record via `deleteOne`
6. Out-of-order: строгий `<` timestamp check на `lastProviderEventAt`
7. `WEBHOOK_MONGO_TIMEOUT_MS = 10000` -- safety timeout для всіх MongoDB ops
8. Never throws (webhook always returns 200)

### Обробка помилок

Файл: `apps/api/src/common/filters/all-exceptions.filter.ts`

- Global `@Catch()` filter
- Response: `{ error: { code: ResponseCode, message: string } }`
- Mapping: 400->VALIDATION_ERROR, 401->UNAUTHORIZED, 404->NOT_FOUND, 429->RATE_LIMIT_EXCEEDED, 5xx->INTERNAL_ERROR
- Exceptions can pass `{ code: string }` explicitly (e.g., SubscriptionGuard)
- 5xx logged with stack trace; lower errors as warnings

### Payment Provider Interface

Файл: `apps/api/src/modules/payments/interfaces/payment-provider.interface.ts`

```typescript
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

interface IPaymentProvider {
    createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutResult>;
    createPortalSession(providerCustomerId: string): Promise<PortalResult>;
    handleWebhookPayload(rawBody: Buffer, signatureHeader: string): BillingWebhookEvent | null;
}
```

StripeService handles 4 event types: `checkout.session.completed`/`async_payment_succeeded` (maps to ONE_OFF or CHECKOUT_COMPLETED by mode), `customer.subscription.updated`, `customer.subscription.deleted`. Metadata passed to Stripe: userId, planCode, credits.

### Auth flow (Google OAuth)

1. Client -> `GET /api/auth/google` -> Google consent
2. Google -> `GET /api/auth/google/callback` -> GoogleStrategy (validates email verified) -> `handleGoogleAuth()`
3. `findOrCreateByGoogle()` (enriches missing name/avatar) -> `generateTokens()`
4. API sets `bid_refresh` cookie -> redirect to `{WEB_URL}/auth/callback`
5. Web: `refreshToken()` -> `getMe()` -> update store -> redirect to /profile
6. Special: `?account_deleted=true` -> recovery UI на callback page

### Auth flow (Magic Link)

1. `POST /api/auth/magic-link/send` { email, purpose }
2. Rate limit (3/15min) -> dedup (60s) -> 32-byte hex token -> Redis (15min TTL) -> Resend email
3. User clicks -> `GET {WEB_URL}/auth/verify?token=XXX`
4. Web -> `POST /api/auth/magic-link/verify` { token }
5. Redis GETDEL (atomic) -> `findOrCreateByEmail()` -> `generateTokens()` -> cookie -> return user
6. Special: DELETE_ACCOUNT purpose -> soft-delete user, revoke tokens, send confirmation email

### Token refresh (auto)

Файл: `apps/web/src/shared/api/client.ts`

- Access token в closure variable (НЕ localStorage)
- 401 -> `POST /auth/refresh` -> retry; excluded: `/auth/refresh`, `/auth/logout`
- Concurrent refresh deduplication через shared promise
- Failure: clear token + `useAuthStore.getState().clearUser()`

### Refresh token rotation

Файл: `apps/api/src/modules/auth/auth.service.ts`

- **Atomic consume**: Redis GETDEL
- **Grace period 10s**: старий jti -> `rotated` (10s TTL) замість видалення
- **Reuse detection**: jti не в Redis + не `rotated` -> `revokeAllUserTokens()`
- **Token family**: `refresh_family:{userId}` -- Redis Set для масової revoke
- **Token TTL**: Access 1min (test) / 1h (prod), Refresh 2min (test) / 7d (prod)

### i18n -- API code -> frontend message

```
API response: { data: { code: 'MAGIC_LINK_SENT', message: 'Magic link sent' } }
                                                  ^^^^^^^^ English, for devs only
Frontend: getApiMessageKey('MAGIC_LINK_SENT', 'auth')
  -> 'notifications.auth.magic_link_sent'  (if success code)
  -> 'errors.auth.magic_link_sent'         (if error code)
  -> 'errors.generic.unknown'              (final fallback)
```

## API Overview

Prefix: `/api`. Rate limit: 60 req/60s (ThrottlerGuard global).

### Auth (`/api/auth`)

| Method | Path                          | Guard          | Опис                                               |
| ------ | ----------------------------- | -------------- | -------------------------------------------------- |
| GET    | `/api/auth/google`            | Passport       | Redirect до Google consent                         |
| GET    | `/api/auth/google/callback`   | Passport       | OAuth callback -> set cookie -> redirect           |
| POST   | `/api/auth/check-email`       | --             | hasPassword, isNewUser (rate limit: 10/60s per IP) |
| POST   | `/api/auth/login/password`    | --             | Login з password (brute force protection)          |
| POST   | `/api/auth/magic-link/send`   | --             | Відправка magic link (3/15min, dedup 60s)          |
| POST   | `/api/auth/magic-link/verify` | --             | Верифікація token -> cookie + user + accessToken   |
| POST   | `/api/auth/password/set`      | JwtActiveGuard | Встановити пароль (якщо ще немає)                  |
| POST   | `/api/auth/password/change`   | JwtActiveGuard | Змінити пароль (revoke all sessions)               |
| POST   | `/api/auth/password/delete`   | JwtActiveGuard | Видалити пароль                                    |
| POST   | `/api/auth/password/verify`   | JwtActiveGuard | Перевірити пароль (boolean)                        |
| POST   | `/api/auth/refresh`           | Cookie         | Ротація refresh token (grace period 10s)           |
| POST   | `/api/auth/logout`            | Cookie         | Очистка cookie + revoke token                      |

### Users (`/api/users`)

| Method | Path                                | Guard          | Опис                                                  |
| ------ | ----------------------------------- | -------------- | ----------------------------------------------------- |
| GET    | `/api/users/me`                     | JwtActiveGuard | Поточний користувач (з billing, credits)              |
| PATCH  | `/api/users/me`                     | JwtActiveGuard | Оновити профіль (name, avatar)                        |
| PATCH  | `/api/users/me/lang`                | JwtActiveGuard | Оновити мову                                          |
| POST   | `/api/users/account/delete`         | JwtActiveGuard | Ініціювати видалення (password або magic link)         |
| POST   | `/api/users/account/delete/confirm` | JwtActiveGuard | Підтвердити видалення (soft-delete + 30-day grace)    |
| POST   | `/api/users/account/restore`        | JwtAuthGuard   | Відновити акаунт (JwtAuthGuard -- дозволяє deleted)   |

### Payments (`/api/payments`)

| Method | Path                              | Guard          | Опис                                                      |
| ------ | --------------------------------- | -------------- | --------------------------------------------------------- |
| POST   | `/api/payments/checkout-session`  | JwtActiveGuard | Stripe checkout: `{ paymentType, planCode?, packCode? }`  |
| POST   | `/api/payments/portal-session`    | JwtActiveGuard | Stripe billing portal URL                                 |
| POST   | `/api/payments/webhook/:provider` | SkipThrottle   | Webhook (raw body + signature header), provider='stripe'  |

### Root

| Method | Path          | Guard | Опис                              |
| ------ | ------------- | ----- | --------------------------------- |
| GET    | `/api`        | --    | Hello World!                      |
| GET    | `/api/health` | --    | { status, timestamp, environment }|

### Skeleton (немає endpoints)

- `ReportsController` -- CRUD звітів, AI-аналіз
- `StorageService` -- інфраструктурний skeleton

## Configuration & Environment

### FAIL FAST POLICY (MANDATORY)

- **НІКОЛИ** не додавати fallback для URLs, secrets, API keys, connection strings
- **НІКОЛИ** не використовувати `??`, `||`, default params для прихованого поглинання відсутніх env vars
- Якщо env var відсутня -- app МУСИТЬ впасти з чітким повідомленням
- Стосується ОБОХ файлів: `apps/api/src/config/env.ts` і `apps/web/src/shared/config/env.ts`

### API env vars (`apps/api/src/config/env.ts`)

**Required (crash if missing):**

- `MONGODB_URI` -- MongoDB Atlas connection string
- `JWT_ACCESS_SECRET` -- JWT access token signing
- `JWT_REFRESH_SECRET` -- JWT refresh token signing
- `REDIS_URL` -- Redis
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` -- Google OAuth
- `RESEND_API_KEY` -- Resend email service
- `RESEND_FROM_EMAIL` -- **Required in production**, dev fallback: `LucidKit <onboarding@resend.dev>`
- `STRIPE_SECRET_KEY` -- Stripe API key
- `STRIPE_WEBHOOK_SECRET` -- Webhook signature verification
- `STRIPE_PRICE_MONTHLY_USD` -- Stripe price ID for subscription

**Required when one-off enabled:**

- `STRIPE_PRICE_CREDITS_5_USD`, `STRIPE_PRICE_CREDITS_10_USD`, `STRIPE_PRICE_CREDITS_20_USD` -- Stripe price IDs for credit packs

**Optional (мають defaults):**

- `NODE_ENV` -> `'development'`
- `PORT` -> `'4000'`
- `WEB_URL` -> `'http://localhost:3000'`
- `BILLING_SUCCESS_URL` -> `{WEB_URL}/billing/success`
- `BILLING_CANCEL_URL` -> `{WEB_URL}/billing/cancel`
- `PAYMENTS_SUBSCRIPTION_ENABLED` -> `'true'` (feature flag)
- `PAYMENTS_ONE_OFF_ENABLED` -> `'true'` (feature flag, at least one of subscription/one-off must be true)
- Auth config: `AUTH_PASSWORD_MIN_LENGTH` -> `'8'`, `AUTH_LOCKOUT_THRESHOLDS` -> `'5:1,10:5,20:15'`, `AUTH_LOGIN_ATTEMPTS_TTL_MIN` -> `'15'`, `AUTH_MAGIC_LINK_TTL_MIN`, `AUTH_MAGIC_LINK_RATE_LIMIT`, `AUTH_MAGIC_LINK_RATE_WINDOW_MIN`, `AUTH_MAGIC_LINK_DEDUP_SEC`
- `ACCOUNT_DELETION_GRACE_DAYS` -> `'30'`

**STRIPE_CREDIT_PACKS**: Runtime config object mapping packCode -> {priceId, credits}. Only populated when `PAYMENTS_ONE_OFF_ENABLED=true`.

### Web env vars (`apps/web/src/shared/config/env.ts`)

**Required (crash if missing):**

- `NEXT_PUBLIC_BASE_URL` -- canonical URL
- `NEXT_PUBLIC_API_URL` -- API URL (client-side)

**Optional:**

- `NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED` -> `'true'` (feature flag)
- `NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED` -> `'true'` (feature flag)

**next.config.ts (server-side only):**

- `API_INTERNAL_URL` -> `'http://localhost:4000'` (proxy destination for `/api/*` rewrites)

## Common Commands

```bash
# Development
pnpm dev                                              # Всі apps через Turborepo
pnpm build                                            # Build all
pnpm lint                                             # Lint all
pnpm format                                           # Prettier format
pnpm test                                             # Test all via Turborepo

# API тести
pnpm --filter api test                                # Unit тести
pnpm --filter api test:watch                          # Watch mode
pnpm --filter api test:e2e                            # E2E тести
pnpm --filter api test:cov                            # Coverage

# Web тести
pnpm --filter web test                                # Unit тести (jsdom)

# Docker
docker compose -f docker-compose.dev.yml up --build   # Dev: mongo:7 + redis:7-alpine + apps
docker compose up --build -d                          # Prod

# packages/types
pnpm --filter @lucidkit/types build                   # Compile to CJS in dist/
pnpm --filter @lucidkit/types dev                     # Watch mode
```

## Rules & Conventions

- **TypeScript strict mode** увімкнений в обох apps
- API lint: no `any`, no floating promises, async requires await; test files мають ослаблені правила
- Web lint: extends `eslint-config-next/core-web-vitals` + `typescript`; `@typescript-eslint/no-unused-vars` з `argsIgnorePattern: '^_'`
- `main.ts` використовує `void bootstrap()` -- не `.finally()`
- Mongoose schemas потребують `!` (definite assignment) на всіх `@Prop()` полях
- Cookie для refresh token: `bid_refresh`, httpOnly, secure (prod), sameSite=lax, path=/, maxAge=7d
- Frontend: Feature-Sliced Design (`app/`, `features/`, `entities/`, `widgets/`, `shared/`)
- UI компоненти: `Component.tsx` + `types.ts` + `index.ts` структура; UiButton polymorphic (button/link/a)
- Locales: `uk` (default), `en`; routing через next-intl `defineRouting()`
- Theme: next-themes (attribute: class, storageKey: theme, defaultTheme: system, disableTransitionOnChange: true)
- **Zod = single source of truth**: схеми в `packages/types`, types через `z.infer`, валідація на API і Web
- DTOs на API: `createZodDto(ZodSchema)` з `nestjs-zod` (НЕ class-validator)
- API response format: `{ data: {...} }` для success, `{ error: { code, message } }` для errors
- API message responses: `{ data: { code: ResponseCode, message: string } }` -- `RESPONSE_CODE` з `@lucidkit/types`
- Access token: в пам'яті (closure), refresh token: httpOnly cookie
- Zustand stores без Provider -- працюють напряму; initial `isLoading=true`
- Prettier: singleQuote, tabWidth 4, trailingComma es5, semi true, printWidth 80
- Web: prettier-plugin-tailwindcss для сортування класів
- i18n message keys: `{page}_page.{section}.{key}` або `components.{component}.{key}`
- i18n notifications: `notifications.{module}.{code}`, errors: `errors.{module}.{code}`, fallback: `errors.generic.{code}`
- Web path aliases: `@/*` -> `./src/*`, `@lucidkit/types` -> `../../packages/types/src/index.ts`
- Server components за замовчуванням, `'use client'` лише де потрібно
- **Tone convention**: classic-polite (формальне "ви", без емодзі, 1-2 речення, минулий час для success)
- **i18n convention**: Backend тільки англійська (code + message), frontend маппить code -> i18n key; emails -- виняток (user language)
- Password hashing: bcrypt з salt rounds 10
- `rawBody: true` в `main.ts` -- критично для Stripe webhook signature verification
- Next.js: dev з `--turbopack`, build з `output: 'standalone'`, API proxy через rewrites

## Known Complexities

### Guards -- JwtAuthGuard vs JwtActiveGuard

Файл: `apps/api/src/common/guards/jwt-active.guard.ts`
`JwtActiveGuard` extends `JwtAuthGuard` + overrides `handleRequest()` для reject users з `deletedAt !== null`. Більшість protected endpoints використовують `JwtActiveGuard`. Виняток: `POST /users/account/restore` використовує `JwtAuthGuard` (дозволяє deleted users відновити акаунт).

### Payments -- two-phase webhook idempotency

Файл: `apps/api/src/modules/payments/payments.service.ts`
Three phases: (1) Insert `ProcessedWebhookEvent` as `'pending'` -- duplicate key 11000 -> check existing: `'applied'`=skip, `'pending'`=retry. (2) Process event: subscriptions via atomic MongoDB billing update, one-off via `addCredits()`. (3) Mark `'applied'` on success; on failure rollback pending record via `deleteOne`. Never throws (webhook must return 200). `WEBHOOK_MONGO_TIMEOUT_MS=10000` safety timeout.

### Payments -- out-of-order events

Subscription billing update uses atomic MongoDB query with guard: only updates if `billing.lastProviderEventAt` is null OR `<= event.occurredAt`. Two-phase update: Phase 1 updates existing billing via dot-notation, Phase 2 initializes full billing object if billing=null.

### Payments -- subscription + one-off coexistence

`CreateCheckoutSessionSchema` uses discriminated union by `paymentType`: SUBSCRIPTION requires `planCode`, ONE_OFF requires `packCode`. Feature flags (`PAYMENTS_SUBSCRIPTION_ENABLED`, `PAYMENTS_ONE_OFF_ENABLED`) control availability; at least one must be enabled (validated at module load). `STRIPE_CREDIT_PACKS` config only populated when one-off enabled.

### Stripe rawBody

Файл: `apps/api/src/main.ts`
`rawBody: true` у `NestFactory.create()` -- необхідно для `stripe.webhooks.constructEvent()`. Доступ через `req.rawBody` (Buffer). Без цього signature verification failing.

### packages/types build order

`packages/types` МУСИТЬ бути зібраний до JS перед API/Web у Docker (enforced в docker-compose.dev.yml). **НІКОЛИ** не додавати `paths: { "@lucidkit/types": [...] }` до API tsconfig -- ламає структуру output. API резолвить через workspace symlink -> `dist/`. Web може мати `paths` (Next.js бандлер, points to source `../../packages/types/src/index.ts`).

### UsersModule <-> AuthModule circular dependency

`UsersController` потребує `AuthService` (verifyPassword, sendMagicLink, revokeAllUserTokens). `AuthModule` потребує `UsersModule` (findOrCreate). Вирішено через `forwardRef()` в обох модулях.

### Theme -- next-themes + dynamic import

`ChangeTheme` імпортується з `dynamic(..., { ssr: false })` у Header -- уникає hydration mismatch.

### In-memory access token

Access token у closure variable (не localStorage). Axios interceptor дедуплікує concurrent refresh requests через shared promise. На failure динамічно імпортує auth store для clearUser.

### E2E tests -- stateful Redis mock

Файл: `apps/api/test/auth.e2e-spec.ts`, `payments.e2e-spec.ts`
In-memory Map симулює Redis (SET, GET, GETDEL, INCR, EXPIRE, SADD, SMEMBERS, SREM, PIPELINE). TTL ignored in tests. MongoMemoryServer для MongoDB. Payments tests use mock `IPaymentProvider` instead of real Stripe.

### Account deletion -- multi-path confirmation

- passwordHash -> password confirmation modal -> `POST /users/account/delete/confirm`
- OAuth-only -> magic link (DELETE_ACCOUNT) -> verify page обробляє deletion
- `accountDeletionRequestedAt` трекає початок процесу; `deletedAt` -- фактичний soft-delete
- CleanupService: @Cron(EVERY_DAY_AT_3AM) hard-deletes expired (30 days) + revokeAllUserTokens per user

### Suspense у verify page та profile page

`useSearchParams()` вимагає Suspense boundary. Verify page -> `<Suspense>` + `VerifyContent`. Profile page -> `<Suspense>` + inner content (reads `?mode=` param).

### Signin page -- state machine

Файл: `apps/web/src/app/[locale]/auth/signin/page.tsx` (450 lines)
States: `email | loading | password | magic-link-sent | recovery | error`. Retry-after header parsing для rate limits, progressive lockout countdown, grace period recovery for deleted accounts.

### Profile page -- modes via query param

Файл: `apps/web/src/app/[locale]/(protected)/profile/page.tsx`
`?mode=new` -- new user onboarding (editable form, name required). `?mode=set-password` -- set password flow. `?mode=reset-password` -- reset via magic link. `mode=null` -- default view з SecuritySection + DangerZone.

### Billing page -- conditional sections

Файл: `apps/web/src/app/[locale]/(protected)/billing/page.tsx`
Two independent sections controlled by feature flags: subscription (subscribe/manage/cancel) and credits (pack purchase with `CREDIT_PACK_CONFIG` from types). Each section renders only when its flag is enabled.

### test-setup.ts -- Stripe env for unit tests

Файл: `apps/api/src/test-setup.ts`
Sets placeholder Stripe env vars (`sk_test_placeholder`, `whsec_test_placeholder`, `price_test_placeholder`) to satisfy fail-fast policy during unit test runs. Without this, importing `env.ts` crashes tests. Referenced in `package.json` jest `setupFiles`.

### Auth token TTL -- test vs production

Файл: `apps/api/src/modules/auth/auth.service.ts`
Constants at top: `REFRESH_TOKEN_TTL` = 2 min (test) / 7 days (prod). Access token = 1 min (test) / 1 hour (prod). Controlled by `NODE_ENV !== 'production'` check.
