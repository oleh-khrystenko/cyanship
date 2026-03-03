# LucidKit

> AI-сервіс для аналізу фото автомобілів та виявлення прихованих дефектів перед покупкою.

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

Turborepo monorepo з 2 apps + 1 shared package. Auth (Google OAuth + Magic Link + Password) повністю реалізований, включно з profile management, account soft-deletion з 30-day grace period, brute force protection. Payments (Stripe subscription + webhooks + billing portal) повністю реалізований. Reports, Storage — skeleton.

- **apps/api** — NestJS REST API, модульна архітектура, MongoDB через Mongoose, JWT auth, Redis для magic links, token storage, rate limiting, brute force tracking, Stripe webhooks
- **apps/web** — Next.js SSR/CSR з Feature-Sliced Design, i18n, light/dark/system theme (next-themes), auth pages, profile management, billing page
- **packages/types** — Shared Zod-схеми, типи, constants, contracts, validation, enums

## Project Structure

```
lucidkit/
├── apps/
│   ├── api/                              # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts                   # Bootstrap: cookie-parser, rawBody:true, ZodValidationPipe, AllExceptionsFilter, CORS
│   │   │   ├── app.module.ts             # Root: Config, Throttler(60/60s), ScheduleModule, Mongoose, feature modules
│   │   │   ├── app.controller.ts         # GET / (hello), GET /health
│   │   │   ├── config/env.ts             # Fail-fast ENV object + parseLockoutThresholds()
│   │   │   ├── common/
│   │   │   │   ├── decorators/current-user.decorator.ts  # @CurrentUser() → request.user
│   │   │   │   ├── filters/all-exceptions.filter.ts      # Global error handler → { error: { code, message } }
│   │   │   │   ├── guards/jwt-auth.guard.ts              # AuthGuard('jwt')
│   │   │   │   ├── guards/subscription.guard.ts          # CanActivate: user.billing?.hasActiveSubscription
│   │   │   │   └── providers/redis.provider.ts           # REDIS_CLIENT token (ioredis)
│   │   │   └── modules/
│   │   │       ├── auth/                 # ✅ Повністю реалізований
│   │   │       │   ├── auth.module.ts
│   │   │       │   ├── auth.controller.ts # 12 endpoints: Google OAuth, magic-link, password, refresh, logout
│   │   │       │   ├── auth.service.ts   # Tokens, magic links, rate limiting, brute force, password, rotation
│   │   │       │   ├── services/email.service.ts          # Resend: 4 email templates × 2 langs
│   │   │       │   ├── strategies/jwt.strategy.ts, google.strategy.ts
│   │   │       │   └── dto/              # 7 Zod DTOs
│   │   │       ├── users/                # ✅ Повністю реалізований
│   │   │       │   ├── users.module.ts
│   │   │       │   ├── users.controller.ts  # 6 endpoints: getMe, updateProfile, updateLang, deleteAccount, confirmDelete, restore
│   │   │       │   ├── users.service.ts     # CRUD, findOrCreate, profile, soft-delete, restore, credits
│   │   │       │   ├── cleanup.service.ts   # @Cron(EVERY_DAY_AT_3AM) hard-delete expired accounts
│   │   │       │   ├── schemas/user.schema.ts  # Mongoose: email, provider, profile, credits, passwordHash, deletedAt, billing
│   │   │       │   └── dto/
│   │   │       ├── payments/             # ✅ Повністю реалізований
│   │   │       │   ├── payments.module.ts
│   │   │       │   ├── payments.controller.ts  # 3 endpoints: checkout-session, portal-session, webhook/stripe
│   │   │       │   ├── payments.service.ts     # Checkout, portal, webhook processing, idempotency
│   │   │       │   ├── providers/
│   │   │       │   │   ├── stripe.service.ts           # IPaymentProvider impl, 3 event types
│   │   │       │   │   └── payment-provider.provider.ts # DI factory → StripeService
│   │   │       │   ├── interfaces/payment-provider.interface.ts  # PAYMENT_PROVIDER token + interface
│   │   │       │   ├── schemas/processed-webhook-event.schema.ts # Idempotency tracking
│   │   │       │   └── dto/create-checkout-session.dto.ts
│   │   │       ├── reports/              # 🟡 Skeleton (empty controller + service)
│   │   │       └── storage/              # 🟡 Skeleton (no controller, service only)
│   │   └── test/
│   │       ├── app.e2e-spec.ts
│   │       ├── auth.e2e-spec.ts          # E2E: MongoMemoryServer + stateful Redis mock
│   │       ├── payments.e2e-spec.ts      # E2E: Full payments flow + webhook simulation (600+ lines)
│   │       └── jest-e2e.json
│   │
│   └── web/                              # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── providers.tsx         # next-themes ThemeProvider
│       │   │   ├── globals.css
│       │   │   └── [locale]/
│       │   │       ├── layout.tsx        # Providers, AuthInitializer, Header, Mulish font
│       │   │       ├── page.tsx          # Welcome page (public)
│       │   │       ├── auth/
│       │   │       │   ├── signin/page.tsx   # Email → password/magic-link decision (450 lines)
│       │   │       │   ├── callback/page.tsx # OAuth callback handler
│       │   │       │   └── verify/page.tsx   # Magic link verification (Suspense, 4 purposes)
│       │   │       └── (protected)/
│       │   │           ├── layout.tsx        # AuthGuard wrapper
│       │   │           ├── profile/page.tsx  # Profile management
│       │   │           └── billing/
│       │   │               ├── page.tsx      # Subscription UI (subscribe/manage)
│       │   │               ├── layout.tsx
│       │   │               ├── success/page.tsx
│       │   │               └── cancel/page.tsx
│       │   ├── features/
│       │   │   ├── auth/                 # AuthInitializer, AuthGuard + specs
│       │   │   ├── change-lang/          # Language switcher
│       │   │   ├── change-theme/         # Theme toggle (dynamic ssr:false)
│       │   │   └── profile/              # ProfileForm, SecuritySection, DangerZone, DeleteAccountModal
│       │   ├── widgets/header/           # Sticky header: Logo + user info/auth + theme + lang + logout
│       │   ├── shared/
│       │   │   ├── api/
│       │   │   │   ├── client.ts         # Axios + 401 auto-refresh interceptor + in-memory token
│       │   │   │   ├── auth.ts           # Auth API calls (17 functions)
│       │   │   │   ├── payments.ts       # createCheckoutSession, createPortalSession
│       │   │   │   ├── mapApiCode.ts     # ResponseCode → i18n key mapping
│       │   │   │   └── index.ts
│       │   │   ├── config/env.ts         # Fail-fast ENV
│       │   │   └── ui/                  # UiButton, UiInput, UiSelect, UiSwitch, UiSpinner
│       │   ├── stores/auth/authStore.ts  # user, isAuthenticated, isLoading (Zustand)
│       │   ├── i18n/                     # routing.ts, request.ts
│       │   └── middleware.ts             # Route protection + i18n
│       └── messages/                     # uk.json, en.json
│
├── packages/
│   └── types/                            # @lucidkit/types
│       └── src/
│           ├── constants/lang.ts
│           ├── enums/response-code.ts, response-type.ts, error-code.ts (deprecated)
│           ├── entities/user.ts          # UserSchema з billing
│           ├── contracts/api.ts, auth.ts, payments.ts, users.ts
│           └── validation/common.ts
│
├── docs/
│   ├── conventions/                      # tone.md, fail-fast.md, i18n.md
│   ├── planning/                         # auth-flow.md, payments-mvp-implementation-blueprint.md
│   └── sprints/, audits/
├── docker-compose.yml, docker-compose.dev.yml
├── turbo.json
├── .prettierrc
└── pnpm-workspace.yaml
```

## Domain Model

### User (реалізований)

Файл: `apps/api/src/modules/users/schemas/user.schema.ts`
Zod: `packages/types/src/entities/user.ts`

| Поле                 | Тип                                      | Опис                        |
| -------------------- | ---------------------------------------- | --------------------------- |
| email                | string (unique, lowercase, trim)         | Email користувача           |
| provider             | `{ name, id }` (optional)                | OAuth провайдер (google)    |
| profile              | `{ name?, avatar? }`                     | Профіль                     |
| credits              | `{ balance: int≥0, freeReportUsed: bool }` | Кредити (default: 0, false) |
| passwordHash         | string \| null                           | bcrypt hash пароля          |
| deletedAt            | Date \| null                             | Soft-delete timestamp       |
| preferredLang        | string                                   | Мова (default: 'uk')        |
| lastLoginAt          | Date (optional)                          | Останній логін              |
| billing              | BillingInfo \| null                      | Дані підписки Stripe        |
| createdAt, updatedAt | Date                                     | Timestamps (auto)           |

**billing поля:** provider, providerCustomerId, providerSubscriptionId, planCode, currency, subscriptionStatus, providerSubscriptionStatus, currentPeriodEnd, cancelAtPeriodEnd, hasActiveSubscription, lastProviderEventAt

**Індекси:** `{ email: 1 }` (unique), `{ 'provider.id': 1 }` (sparse), `{ 'billing.providerCustomerId': 1 }` (sparse), `{ 'billing.providerSubscriptionId': 1 }` (sparse)

### ProcessedWebhookEvent (реалізований)

Файл: `apps/api/src/modules/payments/schemas/processed-webhook-event.schema.ts`

| Поле           | Тип    | Опис                           |
| -------------- | ------ | ------------------------------ |
| provider       | string | 'stripe'                       |
| providerEventId| string | Stripe event ID                |
| receivedAt     | Date   | Коли отримано                  |
| occurredAt     | Date   | Коли сталося (Stripe timestamp)|
| type           | string | CHECKOUT_COMPLETED / SUBSCRIPTION_UPDATED / SUBSCRIPTION_DELETED |
| userId         | string \| null | ID користувача        |

**Унікальний індекс:** `{ provider: 1, providerEventId: 1 }` — для idempotency

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
| `enums/error-code.ts`    | ⚠️ DEPRECATED. Kept for AllExceptionsFilter backward compat                        |
| `enums/response-code.ts` | Primary. `RESPONSE_CODE`: auth success, users success, payments errors, error codes. `RESPONSE_CODE_TYPE` mapping |
| `enums/response-type.ts` | `RESPONSE_TYPE = { SUCCESS, ERROR }`, `ResponseType` type                          |
| `entities/user.ts`       | `UserSchema` з billing, `UserProfileSchema`, `UserCreditsSchema`, `UserBillingSchema` |
| `contracts/api.ts`       | `ApiErrorSchema`, `ApiResponse<T>`, `ApiMessageResponse`                           |
| `contracts/auth.ts`      | `MAGIC_LINK_PURPOSE` (4 values), auth schemas (8)                                  |
| `contracts/payments.ts`  | `SUBSCRIPTION_STATUS`, `BILLING_EVENT_TYPE`, `CreateCheckoutSessionSchema`, `UserBillingSchema`, `BillingWebhookEventSchema` |
| `contracts/users.ts`     | `UpdateLangSchema`, `UpdateProfileSchema`                                          |
| `validation/common.ts`   | `emailSchema`, `passwordSchema` (min 8), `objectIdSchema`                          |

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
│   └── Exports: [AuthService, EmailService, REDIS_CLIENT]
├── UsersModule
│   ├── MongooseModule.forFeature(User)
│   ├── AuthModule (forwardRef — circular)
│   ├── Providers: [UsersService, CleanupService]
│   └── Exports: [UsersService]
├── PaymentsModule
│   ├── MongooseModule.forFeature(ProcessedWebhookEvent)
│   ├── UsersModule
│   ├── Providers: [PaymentsService, StripeService, paymentProviderProvider]
│   └── Exports: [PaymentsService]
├── ReportsModule — skeleton
└── StorageModule — skeleton
```

**Крос-модульні залежності:**
- `AuthModule` → `UsersModule` (findOrCreate users)
- `UsersModule` → `AuthModule` (sendMagicLink, verifyPassword, revokeAllUserTokens)
- `PaymentsModule` → `UsersModule` (findById for billing updates)

### Frontend (apps/web)

```
layout.tsx ([locale])
├── Providers (next-themes)
├── NextIntlClientProvider (i18n)
├── AuthInitializer (silent token refresh, skips /auth/*)
├── Header → Logo, user info, Logout, ChangeTheme, ChangeLang
└── {children} — pages including billing/

middleware.ts
├── i18n (createIntlMiddleware)
├── Protected: /profile, /pay, /billing → redirect if no bid_refresh cookie
└── Auth: /auth/signin → redirect to /profile if bid_refresh exists
```

## Key Patterns

### Створення нового API endpoint

Файл: `apps/api/src/modules/payments/payments.controller.ts`

```typescript
@Post('checkout-session')
@UseGuards(JwtAuthGuard)
async createCheckoutSession(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateCheckoutSessionDto,
): Promise<{ data: { checkoutUrl: string } }> {
    const { checkoutUrl } = await this.paymentsService.createCheckoutSession(
        user._id.toString(), dto.planCode,
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

### Авторизація

```typescript
@UseGuards(JwtAuthGuard)
@Get('me')
getMe(@CurrentUser() user: UserDocument) {
    return { data: { id: user._id, email: user.email, ... } };
}
```

Subscription guard (для платного контенту):
```typescript
@UseGuards(JwtAuthGuard, SubscriptionGuard)
```
`SubscriptionGuard` перевіряє `user.billing?.hasActiveSubscription === true`, throws ForbiddenException з кодом `SUBSCRIPTION_REQUIRED`.

### Webhook обробка

Файл: `apps/api/src/modules/payments/payments.service.ts`

1. Перевірка підпису через `IPaymentProvider.handleWebhookPayload(rawBody, signatureHeader)`
2. Idempotency: `insertWebhookEvent()` → duplicate key 11000 = skip
3. Out-of-order: строгий `<` timestamp check
4. `buildBillingUpdate(event, user)` → mongo update
5. `rawBody: true` в `main.ts` для Stripe signature verification

### Обробка помилок

Файл: `apps/api/src/common/filters/all-exceptions.filter.ts`

- Global `@Catch()` filter
- Response: `{ error: { code: string, message: string } }`
- Mapping: 400→VALIDATION_ERROR, 401→UNAUTHORIZED, 404→NOT_FOUND, 429→RATE_LIMIT_EXCEEDED, 5xx→INTERNAL_ERROR
- Exceptions can pass `{ code: string }` explicitly

### Payment Provider Interface

Файл: `apps/api/src/modules/payments/interfaces/payment-provider.interface.ts`

```typescript
// DI token
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

// Interface
interface IPaymentProvider {
    createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutResult>;
    createPortalSession(providerCustomerId: string): Promise<PortalResult>;
    handleWebhookPayload(rawBody: Buffer, signatureHeader: string): BillingWebhookEvent | null;
}
```

### Auth flow (Google OAuth)

1. Client → `GET /api/auth/google` → Google consent
2. Google → `GET /api/auth/google/callback` → GoogleStrategy → `handleGoogleAuth()`
3. `findOrCreateByGoogle()` (enriches missing name/avatar) → `generateTokens()`
4. API sets `bid_refresh` cookie → redirect to `{WEB_URL}/auth/callback`
5. Web: `refreshToken()` → `getMe()` → update store → redirect

### Auth flow (Magic Link)

1. `POST /api/auth/magic-link/send` { email, purpose }
2. Rate limit (3/15min) → dedup (60s) → 64-byte hex token → Redis (15min TTL) → Resend email
3. User clicks → `GET {WEB_URL}/auth/verify?token=XXX`
4. Web → `POST /api/auth/magic-link/verify` { token }
5. Redis GETDEL (atomic) → `findOrCreateByEmail()` → `generateTokens()` → cookie → return user

### Token refresh (auto)

Файл: `apps/web/src/shared/api/client.ts`

- Access token в closure variable (НЕ localStorage)
- 401 → `POST /auth/refresh` → retry; excluded: `/auth/refresh`, `/auth/logout`
- Concurrent refresh deduplication через shared promise
- Failure: clear token + dynamic import auth store → clearUser

### Refresh token rotation

Файл: `apps/api/src/modules/auth/auth.service.ts`

- **Atomic consume**: Redis GETDEL
- **Grace period 10s**: старий jti → `rotated` (10s TTL) замість видалення
- **Reuse detection**: jti не в Redis + не `rotated` → `revokeAllUserTokens()`
- **Token family**: `refresh_family:{userId}` — Redis Set для масової revoke

## API Overview

Prefix: `/api`. Rate limit: 60 req/60s (ThrottlerGuard global).

### Auth (`/api/auth`)

| Method | Path                          | Auth     | Опис                                               |
| ------ | ----------------------------- | -------- | -------------------------------------------------- |
| GET    | `/api/auth/google`            | Passport | Redirect до Google consent                         |
| GET    | `/api/auth/google/callback`   | Passport | OAuth callback → set cookie → redirect             |
| POST   | `/api/auth/check-email`       | —        | hasPassword, isNewUser (rate limit: 10/60s per IP) |
| POST   | `/api/auth/login/password`    | —        | Login з password (brute force protection)          |
| POST   | `/api/auth/magic-link/send`   | —        | Відправка magic link (3/15min, dedup 60s)          |
| POST   | `/api/auth/magic-link/verify` | —        | Верифікація token → cookie + user + accessToken    |
| POST   | `/api/auth/password/set`      | JWT      | Встановити пароль (якщо ще немає)                  |
| POST   | `/api/auth/password/change`   | JWT      | Змінити пароль (revoke all sessions)               |
| POST   | `/api/auth/password/delete`   | JWT      | Видалити пароль                                    |
| POST   | `/api/auth/password/verify`   | JWT      | Перевірити пароль (boolean)                        |
| POST   | `/api/auth/refresh`           | Cookie   | Ротація refresh token (grace period 10s)           |
| POST   | `/api/auth/logout`            | Cookie   | Очистка cookie + revoke token                      |

### Users (`/api/users`)

| Method | Path                                | Auth | Опис                                                  |
| ------ | ----------------------------------- | ---- | ----------------------------------------------------- |
| GET    | `/api/users/me`                     | JWT  | Поточний користувач (з billing)                       |
| PATCH  | `/api/users/me`                     | JWT  | Оновити профіль (name, avatar, preferredLang)         |
| PATCH  | `/api/users/me/lang`                | JWT  | Оновити мову                                          |
| POST   | `/api/users/account/delete`         | JWT  | Ініціювати видалення                                  |
| POST   | `/api/users/account/delete/confirm` | JWT  | Підтвердити видалення (soft-delete + 30-day grace)    |
| POST   | `/api/users/account/restore`        | JWT  | Відновити акаунт                                      |

### Payments (`/api/payments`)

| Method | Path                          | Auth          | Опис                                              |
| ------ | ----------------------------- | ------------- | ------------------------------------------------- |
| POST   | `/api/payments/checkout-session` | JWT        | Stripe checkout URL, `{ planCode }`               |
| POST   | `/api/payments/portal-session`   | JWT        | Stripe billing portal URL                         |
| POST   | `/api/payments/webhook/stripe`   | SkipThrottle | Stripe webhook (raw body + stripe-signature)    |

### Root

| Method | Path          | Auth | Опис             |
| ------ | ------------- | ---- | ---------------- |
| GET    | `/api`        | —    | Hello World      |
| GET    | `/api/health` | —    | Status + timestamp |

### Skeleton (немає endpoints)

- `ReportsController` — CRUD звітів, AI-аналіз
- `StorageService` — інфраструктурний skeleton

## Configuration & Environment

### FAIL FAST POLICY (ОБОВ'ЯЗКОВО)

- **НІКОЛИ** не додавати fallback для URLs, secrets, API keys, connection strings
- **НІКОЛИ** не використовувати `??`, `||`, default params для прихованого поглинання відсутніх env vars
- Якщо env var відсутня — app МУСИТЬ впасти з чітким повідомленням
- Стосується ОБОХ файлів: `apps/api/src/config/env.ts` і `apps/web/src/shared/config/env.ts`

### API env vars (`apps/api/src/config/env.ts`)

**Required (crash if missing):**

- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_ACCESS_SECRET` — JWT access token signing
- `JWT_REFRESH_SECRET` — JWT refresh token signing
- `REDIS_URL` — Redis
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` — Google OAuth
- `RESEND_API_KEY` — Resend email service
- `RESEND_FROM_EMAIL` — **Required in production**, dev fallback: `LucidKit <onboarding@resend.dev>`
- `STRIPE_SECRET_KEY` — Stripe API key
- `STRIPE_WEBHOOK_SECRET` — Webhook signature verification
- `STRIPE_PRICE_MONTHLY_USD` — Stripe price ID

**Optional (мають defaults):**

- `NODE_ENV` → `'development'`
- `PORT` → `'4000'`
- `WEB_URL` → `'http://localhost:3000'`
- `BILLING_SUCCESS_URL` → `{WEB_URL}/billing/success`
- `BILLING_CANCEL_URL` → `{WEB_URL}/billing/cancel`
- Auth config: `AUTH_PASSWORD_MIN_LENGTH` → `'8'`, `AUTH_LOCKOUT_THRESHOLDS` → `'5:1,10:5,20:15'`, etc.
- `ACCOUNT_DELETION_GRACE_DAYS` → `'30'`

### Web env vars (`apps/web/src/shared/config/env.ts`)

**Required (crash if missing):**

- `NEXT_PUBLIC_BASE_URL` — canonical URL
- `NEXT_PUBLIC_API_URL` — API URL (client-side)

**next.config.ts (server-side only):**

- `API_INTERNAL_URL` → `'http://localhost:4000'` (proxy destination)

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
- API lint: no `any`, no floating promises, async requires await
- `main.ts` використовує `void bootstrap()` — не `.finally()`
- Mongoose schemas потребують `!` (definite assignment) на всіх `@Prop()` полях
- Cookie для refresh token: `bid_refresh`, httpOnly, secure (prod), sameSite=lax, path=/, maxAge=7d
- Frontend: Feature-Sliced Design (`app/`, `features/`, `entities/`, `widgets/`, `shared/`)
- UI компоненти: `Component.tsx` + `types.ts` + `index.ts` структура; forwardRef де потрібно
- Locales: `uk` (default), `en`; routing через next-intl `defineRouting()`
- Theme: next-themes (attribute: class, storageKey: theme, defaultTheme: system, disableTransitionOnChange: true)
- **Zod = single source of truth**: схеми в `packages/types`, types через `z.infer`, валідація на API і Web
- DTOs на API: `createZodDto(ZodSchema)` з `nestjs-zod` (НЕ class-validator)
- API response format: `{ data: {...} }` для success, `{ error: { code, message } }` для errors
- API message responses: `{ data: { code: ResponseCode, message: string } }` — `RESPONSE_CODE` з `@lucidkit/types`
- Access token: в пам'яті (closure), refresh token: httpOnly cookie
- Zustand stores без Provider — працюють напряму
- Prettier: singleQuote, tabWidth 4, trailingComma es5, semi true, printWidth 80
- Web: prettier-plugin-tailwindcss для сортування класів
- i18n message keys: `{page}_page.{section}.{key}` або `components.{component}.{key}`
- Web path aliases: `@/*` → `./src/*`, `@lucidkit/types` → types source
- Server components за замовчуванням, `'use client'` лише де потрібно
- **Tone convention**: classic-polite (формальне "ви", без емодзі, 1-2 речення, минулий час для success)
- **i18n convention**: Backend тільки англійська (code + message), frontend маппить code → i18n key; emails — виняток
- Password hashing: bcrypt з salt rounds 10
- `rawBody: true` в `main.ts` — критично для Stripe webhook signature verification
- ESLint: test files (spec.ts, e2e-spec.ts) мають ослаблені правила

## Known Complexities

### Payments — webhook idempotency

Файл: `apps/api/src/modules/payments/payments.service.ts`
`ProcessedWebhookEvent` з unique index `{ provider, providerEventId }`. При duplicate key error 11000 → пропускаємо подію (idempotent). Out-of-order protection: `event.occurredAt < lastProviderEventAt` → skip (stale event). Same-second events дозволені для першого запису.

### Payments — out-of-order events

`buildBillingUpdate()` перевіряє строгий `<` timestamp. Якщо подія прийшла пізніше за дату останнього обробленого ивента — skip. Це захищає від race conditions при паралельних вебхуках.

### SubscriptionGuard

Файл: `apps/api/src/common/guards/subscription.guard.ts`
Перевіряє `user.billing?.hasActiveSubscription === true`. Throws `ForbiddenException` з кодом `SUBSCRIPTION_REQUIRED`. Використовується разом з `JwtAuthGuard`.

### Stripe rawBody

Файл: `apps/api/src/main.ts`
`rawBody: true` у `NestFactory.create()` — необхідно для `stripe.webhooks.constructEvent()`. Доступ через `req.rawBody` (Buffer). Без цього signature verification буде failing.

### packages/types build order

`packages/types` МУСИТЬ бути зібраний до JS перед API/Web у Docker. **НІКОЛИ** не додавати `paths: { "@lucidkit/types": [...] }` до API tsconfig — ламає структуру output. API резолвить через workspace symlink → `dist/`. Web може мати `paths` (Next.js бандлер, points to source).

### UsersModule ↔ AuthModule circular dependency

`UsersController` потребує `AuthService` (verifyPassword, sendMagicLink, revokeAllUserTokens). `AuthModule` потребує `UsersModule` (findOrCreate). Вирішено через `forwardRef()` в обох модулях.

### Theme — next-themes + dynamic import

`ChangeTheme` імпортується з `dynamic(..., { ssr: false })` у Header — уникає hydration mismatch.

### In-memory access token

Access token у closure variable (не localStorage). Axios interceptor дедуплікує concurrent refresh requests через shared promise. На failure динамічно імпортує auth store.

### E2E tests — stateful Redis mock

Файл: `apps/api/test/auth.e2e-spec.ts`, `payments.e2e-spec.ts`
In-memory Map симулює Redis (SET, GET, GETDEL, INCR, EXPIRE, SADD, SMEMBERS, SREM, PIPELINE). MongoMemoryServer для MongoDB.

### Account deletion — multi-path confirmation

- passwordHash → password confirmation modal → `POST /users/account/delete/confirm`
- OAuth-only → magic link (DELETE_ACCOUNT) → verify page обробляє deletion

### Suspense у verify page

`useSearchParams()` вимагає Suspense boundary. Verify page → `<Suspense>` + `VerifyContent` inner component для читання `?token=`.

### Signin page — state machine

Файл: `apps/web/src/app/[locale]/auth/signin/page.tsx` (450 lines)
States: `email | loading | password | magic-link-sent | recovery | error`. Retry-after header parsing для rate limits, grace period countdown.
