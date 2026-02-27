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
| Cache          | Redis (ioredis)               | 5.9.3                                 |
| Scheduler      | @nestjs/schedule              | 6.1.1                                 |
| HTTP client    | Axios                         | 1.13.5                                |
| UI примітиви   | Headless UI, Radix            | headlessui 2.2.9, radix-tooltip 1.2.8 |
| Icons          | lucide-react                  | 0.564.0                               |
| Toasts         | Sonner                        | 2.0.7                                 |
| Тести          | Jest + Supertest              | jest 30.2, supertest 7.1.4            |
| Компілятор API | SWC                           | 1.13.5                                |

## Architecture Overview

Turborepo monorepo з 2 apps + 1 shared package. Auth (Google OAuth + Magic Link + Password) повністю реалізований, включно з profile management, account soft-deletion з 30-day grace period, brute force protection. Reports, Storage, Payments — skeleton.

- **apps/api** — NestJS REST API, модульна архітектура, MongoDB через Mongoose, JWT auth, Redis для magic links, token storage, rate limiting, brute force tracking
- **apps/web** — Next.js SSR/CSR з Feature-Sliced Design, i18n, light/dark/system theme (next-themes), auth pages, profile management
- **packages/types** — Shared Zod-схеми, типи, constants, contracts, validation, enums

## Project Structure

```
lucidkit/
├── apps/
│   ├── api/                              # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts                   # Bootstrap: cookie-parser, ZodValidationPipe, AllExceptionsFilter, CORS
│   │   │   ├── app.module.ts             # Root: Config, Throttler(60/60s), ScheduleModule, Mongoose, feature modules
│   │   │   ├── app.controller.ts         # GET / (hello), GET /health
│   │   │   ├── app.service.ts            # Returns "Hello World!"
│   │   │   ├── config/env.ts             # Fail-fast ENV object (loads .env from monorepo root) + parseLockoutThresholds()
│   │   │   ├── common/
│   │   │   │   ├── decorators/current-user.decorator.ts  # @CurrentUser() → request.user
│   │   │   │   ├── filters/all-exceptions.filter.ts      # Global error handler → { error: { code, message } }
│   │   │   │   ├── guards/jwt-auth.guard.ts              # AuthGuard('jwt')
│   │   │   │   └── providers/redis.provider.ts           # REDIS_CLIENT token (ioredis)
│   │   │   └── modules/
│   │   │       ├── auth/                 # ✅ Повністю реалізований
│   │   │       │   ├── auth.module.ts    # Passport, JWT, UsersModule, Redis (OnModuleInit/Destroy)
│   │   │       │   ├── auth.controller.ts # 12 endpoints: Google OAuth, magic-link, password, refresh, logout
│   │   │       │   ├── auth.service.ts   # Tokens, magic links, rate limiting, brute force, password, rotation (503 lines)
│   │   │       │   ├── auth.service.spec.ts  # 40+ test cases
│   │   │       │   ├── auth.controller.spec.ts
│   │   │       │   ├── services/
│   │   │       │   │   ├── email.service.ts       # Resend: 4 email templates (login/register/reset/delete) × 2 langs
│   │   │       │   │   └── email.service.spec.ts
│   │   │       │   ├── strategies/
│   │   │       │   │   ├── jwt.strategy.ts        # Extracts user from DB by sub claim, checks deletedAt
│   │   │       │   │   ├── jwt.strategy.spec.ts
│   │   │       │   │   └── google.strategy.ts     # Validates Google OAuth profile (email verified check)
│   │   │       │   └── dto/              # 7 Zod DTOs (createZodDto)
│   │   │       │       ├── check-email.dto.ts
│   │   │       │       ├── login-password.dto.ts
│   │   │       │       ├── send-magic-link.dto.ts
│   │   │       │       ├── verify-magic-link.dto.ts
│   │   │       │       ├── set-password.dto.ts
│   │   │       │       ├── change-password.dto.ts
│   │   │       │       └── verify-password.dto.ts
│   │   │       ├── users/                # ✅ Повністю реалізований
│   │   │       │   ├── users.module.ts
│   │   │       │   ├── users.controller.ts  # 6 endpoints: getMe, updateProfile, updateLang, deleteAccount, confirmDelete, restore
│   │   │       │   ├── users.controller.spec.ts
│   │   │       │   ├── users.service.ts     # CRUD, findOrCreate, profile, soft-delete, restore, credits
│   │   │       │   ├── users.service.spec.ts
│   │   │       │   ├── cleanup.service.ts   # @Cron(EVERY_DAY_AT_3AM) hard-delete expired accounts (30-day grace)
│   │   │       │   ├── cleanup.service.spec.ts
│   │   │       │   ├── schemas/user.schema.ts  # Mongoose schema: email, provider, profile, credits, passwordHash, deletedAt
│   │   │       │   └── dto/
│   │   │       │       ├── update-lang.dto.ts
│   │   │       │       └── update-profile.dto.ts
│   │   │       ├── reports/              # 🟡 Skeleton (empty controller + service)
│   │   │       ├── storage/              # 🟡 Skeleton (no controller, service only)
│   │   │       └── payments/             # 🟡 Skeleton (empty controller + service)
│   │   ├── test/
│   │   │   ├── app.e2e-spec.ts           # E2E: MongoMemoryServer + mocked Redis
│   │   │   ├── auth.e2e-spec.ts          # E2E: Full auth flows with stateful Redis mock (in-memory Map)
│   │   │   └── jest-e2e.json             # E2E Jest config
│   │   └── Dockerfile                    # 4-stage: base → deps → build → runtime (node dist/main.js)
│   │
│   └── web/                              # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── providers.tsx         # next-themes ThemeProvider (attribute: class, defaultTheme: system)
│       │   │   ├── globals.css           # Imports: tailwindcss, themes, settings, scrollbar, custom-variants, animations
│       │   │   └── [locale]/
│       │   │       ├── layout.tsx        # Providers, AuthInitializer, Header, Mulish font (local woff2)
│       │   │       ├── page.tsx          # Welcome page (public)
│       │   │       ├── auth/
│       │   │       │   ├── signin/page.tsx   # Email → password/magic-link decision, recovery flow (450 lines)
│       │   │       │   ├── callback/page.tsx # OAuth callback handler
│       │   │       │   └── verify/page.tsx   # Magic link verification (Suspense boundary, handles 4 purposes)
│       │   │       └── (protected)/
│       │   │           ├── layout.tsx        # AuthGuard wrapper
│       │   │           └── profile/page.tsx  # Profile management (form + security + danger zone)
│       │   ├── entities/brand/           # Logo component (server component, text-based)
│       │   ├── features/
│       │   │   ├── auth/                 # AuthInitializer, AuthGuard + specs
│       │   │   ├── change-lang/          # Language switcher (country-flag-icons, UiSelect)
│       │   │   ├── change-theme/         # Theme toggle (next-themes, dynamic ssr:false)
│       │   │   └── profile/              # ProfileForm, SecuritySection, DangerZone, DeleteAccountModal
│       │   ├── widgets/header/           # Sticky header: Logo + user info/auth + theme + lang + logout
│       │   ├── shared/
│       │   │   ├── api/
│       │   │   │   ├── client.ts         # Axios instance + 401 auto-refresh interceptor + in-memory token
│       │   │   │   ├── auth.ts           # Auth API calls (magic link, password, refresh, logout, getMe, profile, account)
│       │   │   │   ├── mapApiCode.ts     # ResponseCode → i18n key mapping (notifications/errors)
│       │   │   │   └── index.ts
│       │   │   ├── config/env.ts         # Fail-fast ENV (NEXT_PUBLIC_BASE_URL, NEXT_PUBLIC_API_URL)
│       │   │   ├── fonts/               # Mulish woff2 (cyrillic + latin subsets)
│       │   │   ├── icons/               # GoogleIcon, IconProps type
│       │   │   ├── lib/utils.ts          # composeClasses()
│       │   │   ├── seo/metadata.ts       # fetchMetadata() для canonical URLs, hreflang
│       │   │   ├── styles/              # themes.css, animations.css, scrollbar.css, settings.css, custom-variants.css
│       │   │   ├── types/settings.ts     # THEME enum, Theme, PageParams, MetaProps
│       │   │   └── ui/                  # UiButton, UiInput, UiSelect, UiSwitch, UiSpinner
│       │   ├── stores/
│       │   │   └── auth/authStore.ts     # user, isAuthenticated, isLoading (Zustand)
│       │   ├── i18n/                     # routing.ts, request.ts
│       │   └── middleware.ts             # Route protection (cookie check) + i18n via createIntlMiddleware
│       ├── messages/                     # uk.json, en.json (133 lines each)
│       ├── jest.config.ts               # jsdom, ts-jest, moduleNameMapper aliases
│       ├── postcss.config.mjs           # @tailwindcss/postcss (v4)
│       └── Dockerfile                    # 4-stage with build args for NEXT_PUBLIC_* vars
│
├── packages/
│   └── types/                            # @lucidkit/types
│       └── src/
│           ├── constants/lang.ts         # LANG = { UK: 'uk', EN: 'en' }, Lang type
│           ├── enums/
│           │   ├── error-code.ts         # ⚠️ DEPRECATED (kept for AllExceptionsFilter backward compat)
│           │   ├── response-code.ts      # Primary: RESPONSE_CODE + RESPONSE_CODE_TYPE mapping
│           │   └── response-type.ts      # RESPONSE_TYPE = { SUCCESS, ERROR }
│           ├── entities/user.ts          # Zod: UserSchema, UserProfileSchema, UserCreditsSchema, UserProviderSchema
│           ├── contracts/
│           │   ├── api.ts                # ApiErrorSchema, ApiError, ApiResponse<T>, ApiMessageResponse
│           │   ├── auth.ts               # 8 schemas: SendMagicLink, VerifyMagicLink, CheckEmail, LoginPassword, SetPassword, ChangePassword, VerifyPassword, AuthResponse + MAGIC_LINK_PURPOSE
│           │   └── users.ts              # UpdateLangSchema, UpdateProfileSchema
│           ├── validation/common.ts      # emailSchema, passwordSchema (min 8), objectIdSchema
│           └── index.ts                  # Re-exports all
│
├── docs/                                 # Документація
│   ├── README.md                         # Index of doc blocks
│   ├── conventions/                      # tone.md, fail-fast.md, i18n.md
│   ├── planning/auth-flow.md             # 714 рядків — повна специфікація
│   ├── sprints/
│   │   ├── sprint-003-auth/              # i18n sync plan
│   │   ├── sprint-004-auth/              # 7 phases implementation plan + gap analysis
│   │   └── sprint-005-auth-testing/      # Automated + manual test plans
│   ├── audits/auth/                      # Auth implementation audit (9 findings)
│   └── prompts/                          # Service prompts для агентів (codex, gemini)
├── docker-compose.yml                    # Production (api + web)
├── docker-compose.dev.yml                # Dev (mongo:7 + redis:7-alpine + api + web, polling)
├── turbo.json                            # Build pipeline (dev, build, lint, test)
├── .prettierrc                           # singleQuote, tabWidth 4, trailingComma es5, tailwindcss plugin for web
├── pnpm-workspace.yaml                   # apps/*, packages/*
├── AGENTS.md                             # Architecture documentation for AI agents
└── package.json                          # Root scripts (dev, build, lint, format, test)
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
| passwordHash         | string \| null (optional)                | bcrypt hash пароля          |
| deletedAt            | Date \| null (optional)                  | Soft-delete timestamp       |
| preferredLang        | string                                   | Мова (default: 'uk')        |
| lastLoginAt          | Date (optional)                          | Останній логін              |
| createdAt, updatedAt | Date                                     | Timestamps (auto)           |

**Індекси:** `{ email: 1 }` (unique), `{ 'provider.id': 1 }` (sparse)

**UsersService методи:** findByEmail, findById, findOrCreateByGoogle (enriches missing profile data), findOrCreateByEmail, updateProfile, updateLang, softDelete, restore, deductCredit, hasCredit, setPasswordHash, clearPasswordHash

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

### Report, Payment — **[НЕ РЕАЛІЗОВАНО]**

### Типи в packages/types

| Модуль                 | Зміст                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `constants/lang.ts`    | `LANG` object (as const), `Lang` type                                                                      |
| `enums/error-code.ts`  | ⚠️ DEPRECATED. `ERROR_CODE` (ACCOUNT_DELETED, UNAUTHORIZED, VALIDATION_ERROR, NOT_FOUND, RATE_LIMIT_EXCEEDED, INSUFFICIENT_CREDITS, INTERNAL_ERROR) |
| `enums/response-code.ts` | Primary enum. `RESPONSE_CODE` (MAGIC_LINK_SENT, LOGGED_OUT, PASSWORD_SET, PASSWORD_DELETED, ACCOUNT_DELETED, ACCOUNT_RESTORED, LANG_UPDATED + error codes). `RESPONSE_CODE_TYPE` mapping |
| `enums/response-type.ts` | `RESPONSE_TYPE = { SUCCESS, ERROR }`, `ResponseType` type |
| `entities/user.ts`     | Zod: `UserSchema`, `UserProfileSchema`, `UserCreditsSchema`, `UserProviderSchema`, `UserProfileDataSchema`; Types: `User`, `UserProfile` |
| `contracts/api.ts`     | `ApiErrorSchema`, `ApiError`, `ApiResponse<T>`, `ApiMessageResponse` (з `code: ResponseCode`)              |
| `contracts/auth.ts`    | `MAGIC_LINK_PURPOSE` (LOGIN, REGISTER, RESET_PASSWORD, DELETE_ACCOUNT), `MagicLinkPurposeSchema`, `SendMagicLinkSchema`, `VerifyMagicLinkSchema`, `AuthResponseSchema`, `CheckEmailSchema`, `CheckEmailResponseSchema`, `LoginPasswordSchema`, `SetPasswordSchema`, `ChangePasswordSchema`, `VerifyPasswordSchema` + types |
| `contracts/users.ts`   | `UpdateLangSchema`, `UpdateProfileSchema`                                                                   |
| `validation/common.ts` | `emailSchema`, `passwordSchema` (min 8), `objectIdSchema` (regex /^[a-f\d]{24}$/i)                         |

## Module Dependency Map

### Backend (apps/api)

```
AppModule (root)
├── ConfigModule.forRoot({ isGlobal: true })
├── ThrottlerModule.forRoot({ limit: 60, ttl: 60000 })
│   └── ThrottlerGuard (APP_GUARD — global)
├── ScheduleModule.forRoot()
├── MongooseModule.forRoot(ENV.MONGODB_URI)
├── AuthModule
│   ├── PassportModule
│   ├── JwtModule (JWT_ACCESS_SECRET, 1h)
│   ├── UsersModule (imported via forwardRef)
│   ├── Providers: [AuthService, EmailService, JwtStrategy, GoogleStrategy, redisProvider]
│   ├── Exports: [AuthService, EmailService, REDIS_CLIENT]
│   └── Lifecycle: OnModuleInit (redis ping), OnModuleDestroy (redis quit)
├── UsersModule
│   ├── MongooseModule.forFeature(User)
│   ├── AuthModule (imported via forwardRef — circular)
│   ├── Providers: [UsersService, CleanupService]
│   └── Exports: [UsersService]
├── ReportsModule — skeleton (empty controller + service)
├── StorageModule — skeleton (service only, no controller)
└── PaymentsModule — skeleton (empty controller + service)
```

**Крос-модульні залежності:**

- `AuthModule` → `UsersModule` (findOrCreate users)
- `UsersModule` → `AuthModule` (sendMagicLink for account deletion, verifyPassword, revokeAllUserTokens)

### Frontend (apps/web)

```
layout.tsx ([locale])
├── Providers (next-themes ThemeProvider)
├── NextIntlClientProvider (i18n)
├── AuthInitializer (silent token refresh on load, skips auth pages)
├── Header (widget)
│   ├── Logo (entity/brand) — wrapped in Link to home
│   ├── User info / SignIn button (auth-aware, skeleton while loading)
│   ├── Logout button (auth-aware)
│   ├── ChangeTheme (feature, dynamic import ssr:false) → next-themes
│   └── ChangeLang (feature) → next-intl routing, UiSelect
└── {children} — pages

middleware.ts
├── i18n middleware (next-intl createIntlMiddleware)
├── Protected paths: /profile, /pay → redirect to /auth/signin if no bid_refresh cookie
└── Auth paths: /auth/signin → redirect to /profile if bid_refresh cookie exists
```

### Cross-package

- `apps/web` → `packages/types` (tsconfig paths → source)
- `apps/api` → `packages/types` (workspace symlink → dist/)

## Key Patterns

### Створення нового API endpoint

Файл: `apps/api/src/modules/auth/auth.controller.ts`

```typescript
@Post('magic-link/send')
async sendMagicLink(@Body() dto: SendMagicLinkDto): Promise<ApiMessageResponse> {
    await this.authService.sendMagicLink(dto.email, dto.purpose ?? MAGIC_LINK_PURPOSE.LOGIN);
    return { data: { code: RESPONSE_CODE.MAGIC_LINK_SENT, message: 'Magic link sent' } };
}
```

Response format: `{ data: { code: ResponseCode, message: string } }` для message-only, `{ data: {...} }` для data responses.

### Валідація (Zod)

Файл: `apps/api/src/main.ts` — `ZodValidationPipe` глобально
Файл: `apps/api/src/modules/auth/dto/send-magic-link.dto.ts`

```typescript
export class SendMagicLinkDto extends createZodDto(SendMagicLinkSchema) {}
```

Схеми визначені в `@lucidkit/types`, DTOs обгортають через `createZodDto()` з `nestjs-zod`.

### Авторизація

Файл: `apps/api/src/modules/users/users.controller.ts`

```typescript
@UseGuards(JwtAuthGuard)
@Get('me')
getMe(@CurrentUser() user: UserDocument) {
    return { data: { id: user._id, email: user.email, ... } };
}
```

- `JwtAuthGuard` — перевіряє Bearer token (JWT strategy витягує user з DB за `sub`, перевіряє `deletedAt`)
- `@CurrentUser()` — витягує `request.user`

### Auth flow (Google OAuth)

1. Client → `GET /api/auth/google` → Google consent screen (scope: email, profile)
2. Google → `GET /api/auth/google/callback` → GoogleStrategy validates (email verified check) → AuthService.handleGoogleAuth()
3. findOrCreateByGoogle() (enriches missing name/avatar) → generateTokens()
4. API sets `bid_refresh` cookie → redirect to `{WEB_URL}/auth/callback` (з `?account_deleted=true` якщо deletedAt)
5. Web callback page: `refreshToken()` → `getMe()` → update store → redirect to `/profile`

### Auth flow (Magic Link)

1. Client → `POST /api/auth/magic-link/send` { email, purpose }
2. API normalizes email → Redis rate limit (3/15min) → dedup check (60s) → generate 64-byte hex token → Redis SET magic:{token}={email,purpose} (15min TTL) → Resend HTML email (template за purpose × lang)
3. User clicks link → `GET {WEB_URL}/auth/verify?token=XXX`
4. Web verify page → `POST /api/auth/magic-link/verify` { token }
5. API: Redis GETDEL magic:{token} (atomic) → findOrCreateByEmail() → generateTokens() → sets `bid_refresh` cookie → returns `{ user, accessToken, purpose }`

### Auth flow (Password)

1. Client → `POST /api/auth/check-email` { email } → returns `{ hasPassword, isNewUser }`
2. If hasPassword → `POST /api/auth/login/password` { email, password }
3. API: IP rate limit → brute force check (progressive lockout: 5→1min, 10→5min, 20→15min) → bcrypt.compare → on success: clear attempts, generateTokens()
4. If !hasPassword → magic link flow

### Token refresh (auto)

Файл: `apps/web/src/shared/api/client.ts`

- Access token в пам'яті (closure variable, НЕ localStorage)
- Axios interceptor: на 401 → `POST /auth/refresh` (cookie) → retry original request
- Дедуплікація concurrent refresh requests через shared promise
- Excluded endpoints: `/auth/refresh` та `/auth/logout` НЕ retry на 401
- На failure: clear token + clear auth store (dynamic import) + reject

### Refresh token rotation

Файл: `apps/api/src/modules/auth/auth.service.ts`

- JWT payload: access `{ sub, email }` (1h), refresh `{ sub, email, jti }` (7d)
- **Atomic consume**: Redis GETDEL refresh:{jti}
- **Grace period 10s**: старий token позначається як `rotated` (10s TTL) замість видалення — для concurrent tabs
- **Reuse detection**: якщо jti не знайдено в Redis І НЕ є `rotated` → зловживання сесією → `revokeAllUserTokens()` видаляє всю `refresh_family`
- **Token family**: `refresh_family:{userId}` — Redis Set всіх активних jti для масової revoke
- **Pipeline**: storeRefreshToken, revokeRefreshToken, revokeAllUserTokens використовують Redis pipeline

### Password management

Файл: `apps/api/src/modules/auth/auth.service.ts`

- **Set**: `setPassword()` — bcrypt.hash(password, 10), тільки якщо passwordHash ще немає
- **Change**: `changePassword()` — bcrypt.compare + hash new + revokeAllUserTokens + issue new tokens
- **Delete**: `deletePassword()` — clear passwordHash (дозволяє OAuth/magic-link only login)
- **Verify**: `verifyPassword()` — bcrypt.compare, returns boolean (для account deletion confirmation)

### Account deletion (soft-delete + 30-day grace)

Файл: `apps/api/src/modules/users/users.controller.ts`

1. `POST /users/account/delete` — якщо passwordHash → `{ requiresPassword: true }`, якщо OAuth → sendMagicLink(DELETE_ACCOUNT)
2. `POST /users/account/delete/confirm` — verifyPassword → softDelete() → revokeAllUserTokens → sendDeletionConfirmationEmail → clear cookie
3. `POST /users/account/restore` — restore(userId), clear deletedAt
4. `CleanupService` (`@Cron(EVERY_DAY_AT_3AM)`) — hard-delete users з deletedAt ≤ 30 days ago

### Обробка помилок

Файл: `apps/api/src/common/filters/all-exceptions.filter.ts`

- Global filter для ВСІХ exceptions
- Maps HTTP status → `ERROR_CODE` з `@lucidkit/types`
- Response: `{ error: { code: string, message: string } }`
- Mapping: 400→VALIDATION_ERROR, 401→UNAUTHORIZED, 404→NOT_FOUND, 422→VALIDATION_ERROR, 429→RATE_LIMIT_EXCEEDED, 5xx→INTERNAL_ERROR
- 5xx errors логуються зі stack trace

### Code → i18n key mapping (frontend)

Файл: `apps/web/src/shared/api/mapApiCode.ts`

```typescript
getApiMessageKey(code, module?) → i18n path
// Priority: notifications.{module}.{code} → errors.{module}.{code} → errors.generic.{code} → errors.generic.unknown
```

### Env vars — fail-fast

Файл: `apps/api/src/config/env.ts`, `apps/web/src/shared/config/env.ts`

```typescript
const getEnvVar = (name: string, fallback?: string): string => {
    const value = process.env[name];
    if (!value && fallback === undefined) {
        throw new Error(`Environment variable "${name}" is not defined`);
    }
    return value ?? fallback!;
};
```

### UI компоненти (CVA pattern)

Файл: `apps/web/src/shared/ui/UiButton/UiButton.tsx`

- Кожен компонент: `Component.tsx` + `types.ts` + `index.ts`
- Variants через `class-variance-authority`
- Polymorphic UiButton: `as="button"` | `as="link"` (Next.js Link) | `as="a"` (forwardRef)
- UiInput: forwardRef, error state з повідомленням, IconLeft/IconRight
- UiSelect: Headless UI `Listbox`, forwardRef
- UiSwitch: Headless UI `Switch`, розміри sm/md/lg
- UiSpinner: lucide-react `LoaderCircle` + animate-spin
- Розміри: sm (16px), md (20px), lg (24px) для іконок

### Bootstrap pattern (API)

Файл: `apps/api/src/main.ts`

- `void bootstrap()` — НЕ `.catch()`, НЕ `.finally()`
- Порядок: cookie-parser → globalPrefix `/api` → CORS → ZodValidationPipe → AllExceptionsFilter → listen
- CORS: `['http://localhost:3000', ENV.WEB_URL]`, credentials: true, methods: GET/POST/PUT/PATCH/DELETE
- Listen на `0.0.0.0` для Docker
- Logger: production (error/warn/log), dev (+debug/verbose)

### CSS Theme System

Файл: `apps/web/src/shared/styles/themes.css`

- CSS custom properties: `--primary`, `--background`, `--surface`, `--surface-hover`, `--border`, `--text-primary`, `--text-secondary`, `--success`, `--warning`, `--error`
- Light: `:root` (blue primary #3b82f6, off-white bg #f9fafb)
- Dark: `.dark` selector (lighter blue #60a5fa, dark slate bg #0f172a)
- Tailwind інтеграція через `@theme inline` директиву (TailwindCSS 4.x)
- Custom dark variant: `@custom-variant dark (&:where(.dark, .dark *))`

### SEO metadata

Файл: `apps/web/src/shared/seo/metadata.ts`

- `fetchMetadata()` — динамічно завантажує переклади з `messages/{locale}.json`
- Підтримка custom `meta` prop для override
- Генерує canonical URL, hreflang alternates (x-default → uk, uk-ua, en-ua)
- Використовується через `generateMetadata()` в кожному page component

## API Overview

Prefix: `/api` (global). Rate limit: 60 req/60s (ThrottlerGuard).

### Auth (`/api/auth`)

| Method | Path                          | Auth     | Опис                                                       |
| ------ | ----------------------------- | -------- | ---------------------------------------------------------- |
| GET    | `/api/auth/google`            | Passport | Redirect до Google consent                                 |
| GET    | `/api/auth/google/callback`   | Passport | OAuth callback → set cookie → redirect to WEB_URL/auth/callback |
| POST   | `/api/auth/check-email`       | —        | Перевірка: hasPassword, isNewUser (rate limit: 10/60s per IP) |
| POST   | `/api/auth/login/password`    | —        | Login з email + password (brute force protection)           |
| POST   | `/api/auth/magic-link/send`   | —        | Відправка magic link (rate limit: 3/15min, dedup: 60s)     |
| POST   | `/api/auth/magic-link/verify` | —        | Верифікація token → set cookie → return user + accessToken  |
| POST   | `/api/auth/password/set`      | JWT      | Встановити пароль (якщо ще немає)                           |
| POST   | `/api/auth/password/change`   | JWT      | Змінити пароль (revoke all sessions)                        |
| POST   | `/api/auth/password/delete`   | JWT      | Видалити пароль (OAuth/magic-link only)                     |
| POST   | `/api/auth/password/verify`   | JWT      | Перевірити пароль (boolean)                                 |
| POST   | `/api/auth/refresh`           | Cookie   | Ротація refresh token (grace period 10s)                    |
| POST   | `/api/auth/logout`            | Cookie   | Очистка refresh cookie + revoke token in Redis              |

### Users (`/api/users`)

| Method | Path                              | Auth | Опис                                                                |
| ------ | --------------------------------- | ---- | ------------------------------------------------------------------- |
| GET    | `/api/users/me`                   | JWT  | Поточний користувач (id, email, profile, credits, hasPassword, deletedAt, preferredLang) |
| PATCH  | `/api/users/me`                   | JWT  | Оновити профіль (name, avatar, preferredLang)                       |
| PATCH  | `/api/users/me/lang`              | JWT  | Оновити мову                                                        |
| POST   | `/api/users/account/delete`       | JWT  | Ініціювати видалення (requiresPassword / requiresMagicLink)         |
| POST   | `/api/users/account/delete/confirm` | JWT | Підтвердити видалення з паролем (soft-delete + 30-day grace)        |
| POST   | `/api/users/account/restore`      | JWT  | Відновити акаунт (протягом grace period)                            |

### Root

| Method | Path          | Auth | Опис                             |
| ------ | ------------- | ---- | -------------------------------- |
| GET    | `/api`        | —    | Hello World                      |
| GET    | `/api/health` | —    | Status + timestamp + environment |

### Skeleton (немає endpoints)

- `ReportsController` — CRUD звітів, AI-аналіз
- `PaymentsController` — Оплата credits
- `StorageService` — інфраструктурний skeleton (без контролера)

## Configuration & Environment

### FAIL FAST POLICY (ОБОВ'ЯЗКОВО)

- **НІКОЛИ** не додавати fallback для URLs, secrets, API keys, connection strings
- **НІКОЛИ** не використовувати `??`, `||`, default params для прихованого поглинання відсутніх env vars
- Якщо env var відсутня — app МУСИТЬ впасти з чітким повідомленням
- Це стосується ОБОХ файлів: `apps/api/src/config/env.ts` І `apps/web/src/shared/config/env.ts`

### API env vars (`apps/api/src/config/env.ts`)

**Required (crash if missing):**

- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_ACCESS_SECRET` — JWT access token signing
- `JWT_REFRESH_SECRET` — JWT refresh token signing
- `REDIS_URL` — Redis для magic links + rate limiting
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` — Google OAuth
- `RESEND_API_KEY` — Resend email service
- `RESEND_FROM_EMAIL` — **Required in production** (crash), optional in dev (fallback: `LucidKit <onboarding@resend.dev>`)

**Optional (мають defaults):**

- `NODE_ENV` → `'development'`
- `PORT` → `'4000'`
- `WEB_URL` → `'http://localhost:3000'`
- `AUTH_PASSWORD_MIN_LENGTH` → `'8'`
- `AUTH_LOCKOUT_THRESHOLDS` → `'5:1,10:5,20:15'` (attempts:blockMinutes)
- `AUTH_LOGIN_ATTEMPTS_TTL_MIN` → `'15'`
- `AUTH_MAGIC_LINK_TTL_MIN` → `'15'`
- `AUTH_MAGIC_LINK_RATE_LIMIT` → `'3'`
- `AUTH_MAGIC_LINK_RATE_WINDOW_MIN` → `'15'`
- `AUTH_MAGIC_LINK_DEDUP_SEC` → `'60'`
- `ACCOUNT_DELETION_GRACE_DAYS` → `'30'`

### Web env vars (`apps/web/src/shared/config/env.ts`)

**Required (crash if missing):**

- `NEXT_PUBLIC_BASE_URL` — canonical URL сайту
- `NEXT_PUBLIC_API_URL` — URL бекенду (client-side)

**Used in next.config.ts (not in env.ts):**

- `API_INTERNAL_URL` → `'http://localhost:4000'` (server-side proxy destination)

### next.config.ts

- `output: 'standalone'` — Docker-ready
- `reactStrictMode: true`
- `images.remotePatterns`: `lh3.googleusercontent.com` (Google avatars)
- **API rewrites**: `/api/:path*` → `${API_INTERNAL_URL}/api/:path*` (default: `http://localhost:4000`)
- Завантажує `.env` з monorepo root (`../../.env`) через dotenv override
- next-intl plugin інтеграція через `withNextIntl()`

## Common Commands

```bash
# Development
pnpm dev                                              # Всі apps через Turborepo (Turbopack for web)
pnpm build                                            # Build all
pnpm lint                                             # Lint all
pnpm format                                           # Prettier format
pnpm test                                             # Test all via Turborepo

# API тести
pnpm --filter api test                                # Unit тести
pnpm --filter api test:watch                          # Watch mode
pnpm --filter api test:e2e                            # E2E тести (MongoMemoryServer + mocked Redis)
pnpm --filter api test:cov                            # Coverage

# Web тести
pnpm --filter web test                                # Unit тести (jsdom)

# Docker
docker compose -f docker-compose.dev.yml up --build   # Dev: mongo:7 + redis:7-alpine + apps (polling)
docker compose up --build -d                          # Prod: MongoDB Atlas

# packages/types
pnpm --filter @lucidkit/types build                   # Compile to CJS in dist/
pnpm --filter @lucidkit/types dev                     # Watch mode
```

## Rules & Conventions

- **TypeScript strict mode** увімкнений в обох apps
- API lint: no `any`, no floating promises, async requires await
- `main.ts` використовує `void bootstrap()` — не `.finally()`
- Mongoose schemas потребують `!` (definite assignment) на всіх `@Prop()` полях
- `@/widgets/header` exports `{ Header }` (named, re-exported from default)
- Cookie для refresh token: `bid_refresh`, httpOnly, secure (prod), sameSite=lax, path=/, maxAge=7d
- Frontend: Feature-Sliced Design (`app/`, `features/`, `entities/`, `widgets/`, `shared/`)
- UI компоненти: `Component.tsx` + `types.ts` + `index.ts` структура; forwardRef де потрібно
- Шрифт: Mulish via next/font/local (woff2, subsets: cyrillic, latin; weights: 300, 400, 700)
- Locales: `uk` (default), `en`; routing через next-intl `defineRouting()`
- Theme: next-themes (attribute: class, storageKey: theme, defaultTheme: system, disableTransitionOnChange: true)
- **Zod = single source of truth**: схеми в `packages/types`, types через `z.infer`, валідація на API і Web
- DTOs на API: `createZodDto(ZodSchema)` з `nestjs-zod` (НЕ class-validator)
- API response format: `{ data: {...} }` для success, `{ error: { code, message } }` для errors
- API message responses: `{ data: { code: ResponseCode, message: string } }` — використовуй `RESPONSE_CODE` з `@lucidkit/types`
- Access token: в пам'яті (closure), refresh token: httpOnly cookie
- Zustand stores без Provider — працюють напряму
- Prettier: singleQuote, tabWidth 4, trailingComma es5, semi true, printWidth 80
- Web: prettier-plugin-tailwindcss для сортування класів (через overrides в .prettierrc)
- i18n message keys: `{page}_page.{section}.{key}` (welcome_page.head.title) або `components.{component}.{key}`
- Web path aliases: `@/*` → `./src/*`, `@lucidkit/types` → types source
- Server components за замовчуванням, `'use client'` лише де потрібно
- **Tone convention**: classic-polite (формальне "ви", без емодзі, 1-2 речення, минулий час для success)
- **i18n convention**: Backend тільки англійська (code + message), frontend маппить code → i18n key через `getApiMessageKey()`; emails — виняток (user.preferredLang)
- TooManyRequestsException: кастомний HttpException (429) в auth.service.ts
- Password hashing: bcrypt з salt rounds 10
- Account deletion: soft-delete (deletedAt field) → 30-day grace → hard-delete via CleanupService cron
- ESLint: test files (spec.ts, e2e-spec.ts) мають ослаблені правила (unbound-method, no-unsafe-assignment)

## Known Complexities

### Theme — next-themes + dynamic import

Файл: `apps/web/src/features/change-theme/ChangeTheme.tsx`
`ChangeTheme` імпортується з `dynamic(..., { ssr: false })` у Header — уникає hydration mismatch. Компонент використовує `useTheme()` з `next-themes`. `providers.tsx` обгортає app у `ThemeProvider` з `attribute: class`, `disableTransitionOnChange: true`.

### packages/types build order

`packages/types` МУСИТЬ бути зібраний до JS перед API/Web у Docker. `tsconfig.build.json` компілює в CJS у `dist/`. **НІКОЛИ** не додавати `paths: { "@lucidkit/types": [...] }` до API tsconfig — це ламає структуру output dir. API резолвить через workspace symlink → `dist/`. Web tsconfig МОЖЕ мати `paths` (Next.js використовує свій бандлер, points to source).

### In-memory access token

Файл: `apps/web/src/shared/api/client.ts`
Access token зберігається в closure variable (не localStorage) для безпеки. Axios interceptor автоматично додає Bearer header та дедуплікує concurrent refresh requests при 401 через shared promise. На failure динамічно імпортує auth store для clear.

### Auth initialization on app load

Файл: `apps/web/src/features/auth/AuthInitializer.tsx`
Компонент виконується один раз (useRef). Пропускає auth pages (`/auth/callback`, `/auth/verify`). Пробує `refreshToken()` → `getMe()` → оновлює store. `isLoading: true` в initial state запобігає flash signin button.

### Two-layer route protection

1. **Middleware** (server) — перевіряє `bid_refresh` cookie, швидкий redirect + i18n через createIntlMiddleware. `stripLocale()` utility для path matching.
2. **AuthGuard** (client) — перевіряє auth store, показує spinner поки loading, redirect через useRouter з locale-aware URL

### Refresh token rotation security

Файл: `apps/api/src/modules/auth/auth.service.ts`
**Atomic consume**: Redis GETDEL замість GET+DEL для запобігання race conditions.
**Grace period (10s)**: При ротації старий jti позначається як `rotated` у Redis замість видалення. Якщо той самий старий token використовується протягом 10s (наприклад, concurrent tabs) — вважається легітимним.
**Reuse detection**: Якщо jti відсутній у Redis І НЕ є `rotated` → зловживання сесією → `revokeAllUserTokens()` видаляє всю `refresh_family`.
**Pipeline**: Всі multi-step Redis operations використовують pipeline (storeRefreshToken, revokeRefreshToken, revokeAllUserTokens).

### Magic link rate limiting + dedup

Файл: `apps/api/src/modules/auth/auth.service.ts`
Redis-based: max 3 requests per email per 15min (INCR + EXPIRE). Token: 64-byte hex (256-bit), TTL 15min. Email normalization: trim + toLowerCase. Dedup: skip sending if `magic_dedup:{email}:{purpose}` exists (60s TTL).

### Brute force protection (progressive lockout)

Файл: `apps/api/src/modules/auth/auth.service.ts`
Configurable thresholds via `AUTH_LOCKOUT_THRESHOLDS` env var (default: `5:1,10:5,20:15`). Tracking key: `login_attempts:{ip}:{email}` (15min TTL). Calculates block duration based on highest exceeded threshold. On success: clear all attempts.

### Suspense у verify page

Файл: `apps/web/src/app/[locale]/auth/verify/page.tsx`
`useSearchParams()` вимагає Suspense boundary у Next.js App Router. Verify page обгорнута у `<Suspense>` з `VerifyContent` inner component для читання `?token=` параметру. Handles 4 magic link purposes: login, register, reset-password, delete-account.

### UsersModule ↔ AuthModule circular dependency

`UsersController` потребує `AuthService` (для verifyPassword, sendMagicLink, revokeAllUserTokens при account deletion). `AuthModule` потребує `UsersModule` (для findOrCreate). Вирішено через `forwardRef()` в обох модулях.

### next.config.ts env loading + API proxy

Файл: `apps/web/next.config.ts`
dotenv завантажує `.env` з monorepo root (`../../.env`) з override. `NEXT_PUBLIC_*` змінні мають використовувати прямий `process.env.VAR` доступ для Next.js inlining. API rewrites проксують `/api/*` на `API_INTERNAL_URL` (для Docker networking).

### Docker dev polling

Файл: `docker-compose.dev.yml`
File watching в Docker потребує polling: `TSC_WATCHFILE=UsePolling` (API), `WATCHPACK_POLLING=true` + `CHOKIDAR_USEPOLLING=true` (Web). Build pipeline: `pnpm install → types build → app dev`. Shared pnpm-store volume.

### Google OAuth profile enrichment

Файл: `apps/api/src/modules/users/users.service.ts`
`findOrCreateByGoogle()` оновлює missing profile.name та profile.avatar на existing users (enrichment при кожному логіні).

### Account deletion — multi-path confirmation

Файл: `apps/api/src/modules/users/users.controller.ts`
- Якщо є passwordHash → frontend показує password confirmation modal → `POST /users/account/delete/confirm`
- Якщо OAuth-only → API надсилає magic link (purpose: DELETE_ACCOUNT) → verify page обробляє deletion
- В обох випадках: softDelete → revokeAllUserTokens → sendDeletionConfirmationEmail → clear cookie

### Profile page — query params modes

Файл: `apps/web/src/app/[locale]/(protected)/profile/page.tsx`
- `?mode=new` — новий користувач, name required, password optional
- `?mode=set-password` — OAuth user встановлює пароль
- `?mode=reset-password` — скидання пароля через magic link
- No mode — стандартний перегляд/редагування профілю

### Signin page — state machine

Файл: `apps/web/src/app/[locale]/auth/signin/page.tsx` (450 lines)
States: `email | loading | password | magic-link-sent | recovery | error`. Handles progressive UI disclosure, retry-after header parsing for rate limits, account recovery with grace period countdown (days remaining).

### Email service — bilingual templates

Файл: `apps/api/src/modules/auth/services/email.service.ts`
4 email templates × 2 languages (UK + EN). Purpose-specific subjects and bodies. Uses `user.preferredLang` for localization. Formats deletion date localized (uk-UA / en-US).

### E2E tests — stateful Redis mock

Файл: `apps/api/test/auth.e2e-spec.ts`
Uses in-memory Map to simulate Redis operations (SET, GET, GETDEL, DEL, INCR, EXPIRE, SADD, SMEMBERS, SREM, PIPELINE). Allows full auth flow testing without real Redis connection. MongoMemoryServer for MongoDB.

### Known audit findings

Файл: `docs/audits/auth/auth-implementation-audit.md`
9 знахідок (1 critical, 3 high, 4 medium, 3 low). Ключові: F-01 production resources in .env (critical), F-02 magic-link race condition (high, partially fixed via GETDEL), F-03 Google OAuth state validation incomplete (high), E2E тести потребують мокування зовнішніх залежностей.

### Planned: auth-flow.md specification

Файл: `docs/planning/auth-flow.md` (714 рядків)
Повна специфікація auth flow включає: password auth (implemented), account deletion з 30-day grace period (implemented), brute force protection (implemented), magic link context (implemented), progressive disclosure UI.
