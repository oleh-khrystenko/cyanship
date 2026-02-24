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
| Styling        | TailwindCSS + CVA             | 4.1.16                                |
| State          | Zustand                       | 5.0.11                                |
| i18n           | next-intl                     | 4.4.0                                 |
| Theme          | next-themes                   | 0.4.6                                 |
| Auth           | Passport + JWT + Google OAuth | passport 0.7, @nestjs/jwt 11.0        |
| Validation     | Zod + nestjs-zod              | zod 4.3.6, nestjs-zod 5.1.1           |
| Email          | Resend                        | 6.9.2                                 |
| Cache          | Redis (ioredis)               | 5.9.3                                 |
| HTTP client    | Axios                         | 1.13.5                                |
| UI примітиви   | Headless UI, Radix            | headlessui 2.2.9, radix-tooltip 1.2.8 |
| Icons          | lucide-react                  | 0.564.0                               |
| Toasts         | Sonner                        | 2.0.7                                 |
| Тести          | Jest + Supertest              | jest 30.2, supertest 7.1.4            |
| Компілятор API | SWC                           | 1.13.5                                |

## Architecture Overview

Turborepo monorepo з 2 apps + 1 shared package. Auth (Google OAuth + Magic Link) повністю реалізований. Reports, Storage, Payments — skeleton.

- **apps/api** — NestJS REST API, модульна архітектура, MongoDB через Mongoose, JWT auth, Redis для magic links та token storage
- **apps/web** — Next.js SSR/CSR з Feature-Sliced Design, i18n, light/dark/system theme (next-themes), auth pages
- **packages/types** — Shared Zod-схеми, типи, constants, contracts, validation

## Project Structure

```
lucidkit/
├── apps/
│   ├── api/                              # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts                   # Bootstrap: cookie-parser, ZodValidationPipe, AllExceptionsFilter, CORS
│   │   │   ├── app.module.ts             # Root: Config, Throttler(60/60s), Mongoose, feature modules
│   │   │   ├── app.controller.ts         # GET / (hello), GET /health
│   │   │   ├── app.service.ts            # Returns "Hello World!"
│   │   │   ├── config/env.ts             # Fail-fast ENV object (loads .env from monorepo root)
│   │   │   ├── common/
│   │   │   │   ├── decorators/current-user.decorator.ts  # @CurrentUser() → request.user
│   │   │   │   ├── filters/all-exceptions.filter.ts      # Global error handler → { error: { code, message } }
│   │   │   │   ├── guards/jwt-auth.guard.ts              # AuthGuard('jwt')
│   │   │   │   └── providers/redis.provider.ts           # REDIS_CLIENT token (ioredis)
│   │   │   └── modules/
│   │   │       ├── auth/                 # ✅ Повністю реалізований
│   │   │       │   ├── auth.module.ts    # Passport, JWT, UsersModule, Redis (OnModuleInit/Destroy)
│   │   │       │   ├── auth.controller.ts # Google OAuth + Magic Link + refresh + logout
│   │   │       │   ├── auth.service.ts   # Tokens, magic links, rate limiting, rotation grace period
│   │   │       │   ├── auth.service.spec.ts  # 40+ test cases
│   │   │       │   ├── services/email.service.ts  # Resend integration (UA HTML email)
│   │   │       │   ├── strategies/jwt.strategy.ts
│   │   │       │   ├── strategies/google.strategy.ts
│   │   │       │   └── dto/              # Zod DTOs (createZodDto)
│   │   │       │       ├── send-magic-link.dto.ts
│   │   │       │       └── verify-magic-link.dto.ts
│   │   │       ├── users/                # ✅ Повністю реалізований
│   │   │       │   ├── users.module.ts
│   │   │       │   ├── users.controller.ts  # GET /users/me
│   │   │       │   ├── users.service.ts     # CRUD, findOrCreate, credits
│   │   │       │   ├── users.service.spec.ts  # 18 test cases
│   │   │       │   └── schemas/user.schema.ts  # Mongoose schema
│   │   │       ├── reports/              # 🟡 Skeleton (empty controller + service)
│   │   │       ├── storage/              # 🟡 Skeleton (no controller, service only)
│   │   │       └── payments/             # 🟡 Skeleton (empty controller + service)
│   │   ├── test/app.e2e-spec.ts          # E2E: MongoMemoryServer + mocked Redis
│   │   └── Dockerfile                    # 4-stage: base → deps → build → runtime
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
│       │   │       │   ├── signin/page.tsx   # Google OAuth + Magic Link form (client component)
│       │   │       │   ├── callback/page.tsx # OAuth callback handler
│       │   │       │   └── verify/page.tsx   # Magic link verification (Suspense boundary)
│       │   │       └── (protected)/
│       │   │           ├── layout.tsx        # AuthGuard wrapper
│       │   │           └── check/page.tsx    # Protected page (placeholder, server component)
│       │   ├── entities/brand/           # Logo component (server component, text-based)
│       │   ├── features/
│       │   │   ├── auth/                 # AuthInitializer, AuthGuard
│       │   │   ├── change-lang/          # Language switcher (country-flag-icons, UiSelect)
│       │   │   └── change-theme/         # Theme toggle (next-themes, dynamic ssr:false)
│       │   ├── widgets/header/           # Sticky header: Logo + user info/auth + theme + lang + logout
│       │   ├── shared/
│       │   │   ├── api/client.ts         # Axios instance + 401 auto-refresh interceptor + in-memory token
│       │   │   ├── api/auth.ts           # Auth API calls (magic link, refresh, logout, getMe)
│       │   │   ├── config/env.ts         # Fail-fast ENV
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
│       ├── messages/                     # uk.json, en.json
│       └── Dockerfile                    # 4-stage with build args for NEXT_PUBLIC_* vars
│
├── packages/
│   └── types/                            # @lucidkit/types
│       └── src/
│           ├── constants/lang.ts         # LANG = { UK: 'uk', EN: 'en' }, Lang type
│           ├── enums/error-code.ts       # ERROR_CODE (6 кодів), ErrorCode type
│           ├── entities/user.ts          # Zod schemas: UserSchema, UserProfileSchema, UserCreditsSchema, UserProviderSchema, UserProfileDataSchema
│           ├── contracts/api.ts          # ApiErrorSchema, ApiError, ApiResponse<T> interface
│           ├── contracts/auth.ts         # SendMagicLinkSchema, VerifyMagicLinkSchema, AuthResponseSchema + types
│           ├── validation/common.ts      # emailSchema, objectIdSchema (MongoDB ObjectId regex)
│           └── index.ts                  # Re-exports all
│
├── docs/                                 # Документація
│   ├── README.md                         # Index of doc blocks
│   ├── conventions/                      # tone.md, fail-fast.md, i18n.md
│   ├── planning/                         # auth-flow.md (714 рядків — повна специфікація)
│   ├── sprints/sprint-003-auth/          # Manual E2E test plan (18 scenarios), i18n sync plan
│   ├── audits/auth/                      # Auth implementation audit (9 findings)
│   └── prompts/                          # Service prompts для агентів (codex, gemini)
├── docker-compose.yml                    # Production (api + web)
├── docker-compose.dev.yml                # Dev (mongo:7 + redis:7-alpine + api + web, polling)
├── turbo.json                            # Build pipeline (dev, build, lint, test)
├── .prettierrc                           # singleQuote, tabWidth 4, trailingComma es5, tailwindcss plugin for web
├── pnpm-workspace.yaml                   # apps/*, packages/*
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
| preferredLang        | string                                   | Мова (default: 'uk')        |
| lastLoginAt          | Date (optional)                          | Останній логін              |
| createdAt, updatedAt | Date                                     | Timestamps (auto)           |

**Індекси:** `{ email: 1 }` (unique), `{ 'provider.id': 1 }` (sparse)

**UsersService методи:** findByEmail, findById, findOrCreateByGoogle (enriches missing profile data), findOrCreateByEmail, deductCredit (balance > free > deny), hasCredit

### Redis Keys (тимчасові)

| Ключ                         | Значення         | TTL    | Призначення                       |
| ---------------------------- | ---------------- | ------ | --------------------------------- |
| `magic:{token64}`            | email            | 15 min | Magic link token                  |
| `ratelimit:magic:{email}`    | count            | 15 min | Rate limit лічильник              |
| `refresh:{jti}`              | userId / "rotated" | 7 days / 10s | Refresh token storage      |
| `refresh_family:{userId}`    | Set[jti]         | 7 days | Token family для reuse detection  |

### Report, Payment — **[НЕ РЕАЛІЗОВАНО]**

### Типи в packages/types

| Модуль                 | Зміст                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `constants/lang.ts`    | `LANG` object (as const), `Lang` type                                                                      |
| `enums/error-code.ts`  | `ERROR_CODE` (UNAUTHORIZED, VALIDATION_ERROR, NOT_FOUND, RATE_LIMIT_EXCEEDED, INSUFFICIENT_CREDITS, INTERNAL_ERROR), `ErrorCode` type |
| `entities/user.ts`     | Zod: `UserSchema`, `UserProfileSchema`, `UserCreditsSchema`, `UserProviderSchema`, `UserProfileDataSchema`; Types: `User`, `UserProfile` |
| `contracts/api.ts`     | `ApiErrorSchema`, `ApiError`, `ApiResponse<T>` (з optional `meta`)                                        |
| `contracts/auth.ts`    | `SendMagicLinkSchema`, `VerifyMagicLinkSchema`, `AuthResponseSchema` + types                               |
| `validation/common.ts` | `emailSchema` (z.string().email()), `objectIdSchema` (regex /^[a-f\d]{24}$/i)                              |

## Module Dependency Map

### Backend (apps/api)

```
AppModule (root)
├── ConfigModule.forRoot({ isGlobal: true })
├── ThrottlerModule.forRoot({ limit: 60, ttl: 60000 })
│   └── ThrottlerGuard (APP_GUARD — global)
├── MongooseModule.forRoot(ENV.MONGODB_URI)
├── AuthModule
│   ├── PassportModule
│   ├── JwtModule (JWT_ACCESS_SECRET, 1h)
│   ├── UsersModule (imported)
│   ├── Providers: [AuthService, EmailService, JwtStrategy, GoogleStrategy, redisProvider]
│   └── Exports: [AuthService, REDIS_CLIENT]
│   → lifecycle: OnModuleInit (redis ping), OnModuleDestroy (redis quit)
├── UsersModule
│   ├── MongooseModule.forFeature(User)
│   ├── Providers: [UsersService]
│   └── Exports: [UsersService]
├── ReportsModule — skeleton (empty controller + service)
├── StorageModule — skeleton (service only, no controller)
└── PaymentsModule — skeleton (empty controller + service)
```

**Крос-модульні залежності:**

- `AuthModule` → `UsersModule` (findOrCreate users)

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
├── Protected paths: /check, /pay → redirect to /auth/signin if no bid_refresh cookie
└── Auth paths: /auth/signin → redirect to /check if bid_refresh cookie exists
```

### Cross-package

- `apps/web` → `packages/types` (tsconfig paths → source)
- `apps/api` → `packages/types` (workspace symlink → dist/)

## Key Patterns

### Створення нового API endpoint

Файл: `apps/api/src/modules/auth/auth.controller.ts`

```typescript
@Post('magic-link/send')
async sendMagicLink(@Body() dto: SendMagicLinkDto) {
    await this.authService.sendMagicLink(dto.email);
    return { data: { message: 'Magic link sent' } };
}
```

Контролер в модулі, сервіс інжектиться через constructor DI. Response format: `{ data: {...} }`.

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

- `JwtAuthGuard` — перевіряє Bearer token (JWT strategy витягує user з DB за `sub`)
- `@CurrentUser()` — витягує `request.user`

### Auth flow (Google OAuth)

1. Client → `GET /api/auth/google` → Google consent screen (scope: email, profile)
2. Google → `GET /api/auth/google/callback` → GoogleStrategy validates → AuthService.handleGoogleAuth()
3. findOrCreateByGoogle() (enriches missing name/avatar) → generateTokens()
4. API sets `bid_refresh` cookie → redirect to `{WEB_URL}/auth/callback`
5. Web callback page: `refreshToken()` → `getMe()` → update store → redirect to `/check`

### Auth flow (Magic Link)

1. Client → `POST /api/auth/magic-link/send` { email }
2. API normalizes email (trim + lowercase) → Redis INCR rate limit (3/15min) → generate 64-byte hex token → Redis SET magic:{token}=email (15min TTL) → Resend HTML email
3. User clicks link → `GET {WEB_URL}/auth/verify?token=XXX`
4. Web verify page → `POST /api/auth/magic-link/verify` { token }
5. API: Redis GETDEL magic:{token} (atomic) → findOrCreateByEmail() → generateTokens() → sets `bid_refresh` cookie → returns `{ user, accessToken }`

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

### Обробка помилок

Файл: `apps/api/src/common/filters/all-exceptions.filter.ts`

- Global filter для ВСІХ exceptions
- Maps HTTP status → `ERROR_CODE` з `@lucidkit/types`
- Response: `{ error: { code: string, message: string } }`
- Mapping: 400→VALIDATION_ERROR, 401→UNAUTHORIZED, 404→NOT_FOUND, 422→VALIDATION_ERROR, 429→RATE_LIMIT_EXCEEDED, 5xx→INTERNAL_ERROR
- 5xx errors логуються зі stack trace

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
| POST   | `/api/auth/magic-link/send`   | —        | Відправка magic link на email (rate limit: 3/15min)        |
| POST   | `/api/auth/magic-link/verify` | —        | Верифікація token → set cookie → return user + accessToken |
| POST   | `/api/auth/refresh`           | Cookie   | Ротація refresh token (grace period 10s)                   |
| POST   | `/api/auth/logout`            | —        | Очистка refresh cookie + revoke token in Redis             |

### Users (`/api/users`)

| Method | Path            | Auth | Опис                                                             |
| ------ | --------------- | ---- | ---------------------------------------------------------------- |
| GET    | `/api/users/me` | JWT  | Поточний користувач (id, email, profile, credits, preferredLang) |

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

**Optional (мають defaults):**

- `NODE_ENV` → `'development'`
- `PORT` → `'4000'`
- `WEB_URL` → `'http://localhost:3000'`
- `RESEND_FROM_EMAIL` → `'LucidKit <onboarding@resend.dev>'` (dev fallback, у prod задати кастомний email)

### Web env vars (`apps/web/src/shared/config/env.ts`)

**Required (crash if missing):**

- `NEXT_PUBLIC_BASE_URL` — canonical URL сайту
- `NEXT_PUBLIC_API_URL` — URL бекенду

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
- Access token: в пам'яті (closure), refresh token: httpOnly cookie
- Zustand stores без Provider — працюють напряму
- Prettier: singleQuote, tabWidth 4, trailingComma es5, semi true, printWidth 80
- Web: prettier-plugin-tailwindcss для сортування класів (через overrides в .prettierrc)
- i18n message keys: `{page}_page.{section}.{key}` (welcome_page.head.title) або `components.{component}.{key}`
- Web path aliases: `@/*` → `./src/*`, `@lucidkit/types` → types source
- Server components за замовчуванням, `'use client'` лише де потрібно
- **Tone convention**: classic-polite (формальне "ви", без емодзі, 1-2 речення, минулий час для success)
- **i18n convention**: Backend тільки англійська (code + message), frontend маппить code → i18n key; emails — виняток (user.preferredLang)
- TooManyRequestsException: кастомний HttpException (429) в auth.service.ts

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

### Magic link rate limiting

Файл: `apps/api/src/modules/auth/auth.service.ts`
Redis-based: max 3 requests per email per 15min (INCR + EXPIRE). Token: 64-byte hex (256-bit), TTL 15min. Email normalization: trim + toLowerCase.

### Suspense у verify page

Файл: `apps/web/src/app/[locale]/auth/verify/page.tsx`
`useSearchParams()` вимагає Suspense boundary у Next.js App Router. Verify page обгорнута у `<Suspense>` з `VerifyContent` inner component для читання `?token=` параметру.

### next.config.ts env loading + API proxy

Файл: `apps/web/next.config.ts`
dotenv завантажує `.env` з monorepo root (`../../.env`) з override. `NEXT_PUBLIC_*` змінні мають використовувати прямий `process.env.VAR` доступ для Next.js inlining. API rewrites проксують `/api/*` на `API_INTERNAL_URL` (для Docker networking).

### Docker dev polling

Файл: `docker-compose.dev.yml`
File watching в Docker потребує polling: `TSC_WATCHFILE=UsePolling` (API), `WATCHPACK_POLLING=true` + `CHOKIDAR_USEPOLLING=true` (Web). Build pipeline: `pnpm install → types build → app dev`. Shared pnpm-store volume.

### Google OAuth profile enrichment

Файл: `apps/api/src/modules/users/users.service.ts`
`findOrCreateByGoogle()` оновлює missing profile.name та profile.avatar на existing users (enrichment при кожному логіні).

### Known audit findings

Файл: `docs/audits/auth/auth-implementation-audit.md`
9 знахідок (1 critical, 3 high, 4 medium, 3 low). Ключові: F-01 production resources in .env (critical), F-02 magic-link race condition (high, partially fixed via GETDEL), F-03 Google OAuth state validation incomplete (high), E2E тести потребують мокування зовнішніх залежностей.

### Planned: auth-flow.md specification

Файл: `docs/planning/auth-flow.md` (714 рядків)
Повна специфікація auth flow включає: password auth (not yet implemented), account deletion з 30-day grace period, brute force protection (100 attempts/15min), magic link context (login/register/reset-password/delete-account), progressive disclosure UI.

### Planned: i18n sync

Файл: `docs/sprints/sprint-003-auth/i18n-sync-plan.md`
Пропонує: ResponseType + ResponseCode enums в packages/types, API exception mapping, frontend error code → i18n key mapping.
