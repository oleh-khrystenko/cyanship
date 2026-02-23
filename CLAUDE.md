# LucidKit

> AI-сервіс для аналізу фото автомобілів та виявлення прихованих дефектів перед покупкою.

<!-- MANUAL:START -->

# Rules

- Before making ANY code changes, read the relevant module's files to understand current implementation
- Always check prisma/schema.prisma before modifying data layer
- Always check existing patterns in similar modules before creating new ones

## Project Conventions (ОБОВ'ЯЗКОВО)

All AI agents MUST read and follow rules in `docs/conventions/`:

- **[Tone & Style](docs/conventions/tone.md)** — тон та стиль user-facing повідомлень (toasts, errors, confirmations)
- **[Fail Fast](docs/conventions/fail-fast.md)** — політика обов'язкових env vars

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
│   │   │   ├── config/env.ts             # Fail-fast ENV object
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
│   │   │       │   ├── auth.service.spec.ts
│   │   │       │   ├── services/email.service.ts  # Resend integration (UA HTML email)
│   │   │       │   ├── strategies/jwt.strategy.ts
│   │   │       │   ├── strategies/google.strategy.ts
│   │   │       │   └── dto/              # Zod DTOs (createZodDto)
│   │   │       ├── users/                # ✅ Повністю реалізований
│   │   │       │   ├── users.module.ts
│   │   │       │   ├── users.controller.ts  # GET /users/me
│   │   │       │   ├── users.service.ts     # CRUD, findOrCreate, credits
│   │   │       │   ├── users.service.spec.ts
│   │   │       │   └── schemas/user.schema.ts  # Mongoose schema
│   │   │       ├── reports/              # 🟡 Skeleton
│   │   │       ├── storage/              # 🟡 Skeleton (no controller)
│   │   │       └── payments/             # 🟡 Skeleton
│   │   ├── test/app.e2e-spec.ts
│   │   └── Dockerfile
│   │
│   └── web/                              # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── providers.tsx         # next-themes ThemeProvider (attribute: class, defaultTheme: system)
│       │   │   ├── globals.css           # Imports: tailwindcss, themes, settings, scrollbar, custom-variants, animations
│       │   │   └── [locale]/
│       │   │       ├── layout.tsx        # Providers, AuthInitializer, Header, Mulish font
│       │   │       ├── page.tsx          # Welcome page
│       │   │       ├── auth/
│       │   │       │   ├── signin/page.tsx   # Google OAuth + Magic Link form
│       │   │       │   ├── callback/page.tsx # OAuth callback handler
│       │   │       │   └── verify/page.tsx   # Magic link verification (Suspense boundary)
│       │   │       └── (protected)/
│       │   │           ├── layout.tsx        # AuthGuard wrapper
│       │   │           └── check/page.tsx    # Protected page (placeholder)
│       │   ├── entities/brand/           # Logo component
│       │   ├── features/
│       │   │   ├── auth/                 # AuthInitializer, AuthGuard
│       │   │   ├── change-lang/          # Language switcher (country-flag-icons, UiSelect)
│       │   │   └── change-theme/         # Theme toggle (next-themes, dynamic ssr:false)
│       │   ├── widgets/header/           # Sticky header: Logo + user info/auth + theme + lang + logout
│       │   ├── shared/
│       │   │   ├── api/client.ts         # Axios instance + 401 auto-refresh interceptor
│       │   │   ├── api/auth.ts           # Auth API calls (magic link, refresh, logout, getMe)
│       │   │   ├── config/env.ts         # Fail-fast ENV
│       │   │   ├── icons/               # GoogleIcon, types
│       │   │   ├── lib/utils.ts          # composeClasses()
│       │   │   ├── seo/metadata.ts       # fetchMetadata() для canonical URLs, hreflang
│       │   │   ├── styles/              # themes.css, animations.css, scrollbar.css, settings.css, custom-variants.css
│       │   │   ├── types/settings.ts     # THEME enum, Theme, PageParams, MetaProps
│       │   │   └── ui/                  # UiButton, UiInput, UiSelect, UiSwitch, UiSpinner
│       │   ├── stores/
│       │   │   └── auth/authStore.ts     # user, isAuthenticated, isLoading (Zustand)
│       │   ├── i18n/                     # routing.ts, request.ts
│       │   └── middleware.ts             # Route protection (cookie check) + i18n
│       ├── messages/                     # uk.json, en.json
│       └── Dockerfile
│
├── packages/
│   └── types/                            # @lucidkit/types
│       └── src/
│           ├── constants/lang.ts         # LANG = { UK: 'uk', EN: 'en' }, Lang type
│           ├── enums/error-code.ts       # ERROR_CODE (6 кодів), ErrorCode type
│           ├── entities/user.ts          # Zod schemas: UserSchema, UserProfileSchema, UserCreditsSchema
│           ├── contracts/api.ts          # ApiErrorSchema, ApiResponse<T> interface
│           ├── contracts/auth.ts         # SendMagicLinkSchema, VerifyMagicLinkSchema, AuthResponseSchema
│           ├── validation/common.ts      # emailSchema, objectIdSchema
│           └── index.ts                  # Re-exports all
│
├── docs/                                 # Документація
│   ├── planning/                         # Roadmap, epics (placeholder)
│   ├── sprints/sprint-003/               # Manual E2E auth test plan (18 scenarios)
│   ├── audits/auth/                      # Auth implementation audit (9 findings)
│   └── prompts/                          # Service prompts для агентів (codex, gemini)
├── docker-compose.yml                    # Production (api + web)
├── docker-compose.dev.yml                # Dev (mongo + redis + api + web)
├── turbo.json                            # Build pipeline
├── pnpm-workspace.yaml                   # apps/*, packages/*
└── package.json                          # Root scripts
```

## Domain Model

### User (реалізований)

Файл: `apps/api/src/modules/users/schemas/user.schema.ts`
Zod: `packages/types/src/entities/user.ts`

| Поле                 | Тип                                      | Опис                        |
| -------------------- | ---------------------------------------- | --------------------------- |
| email                | string (unique, lowercase)               | Email користувача           |
| provider             | `{ name, id }` (optional)                | OAuth провайдер (google)    |
| profile              | `{ name?, avatar? }`                     | Профіль                     |
| credits              | `{ balance: int, freeReportUsed: bool }` | Кредити (default: 0, false) |
| preferredLang        | string                                   | Мова (default: 'uk')        |
| lastLoginAt          | Date (optional)                          | Останній логін              |
| createdAt, updatedAt | Date                                     | Timestamps (auto)           |

**Індекси:** sparse index на `provider.id`

### Redis Keys (тимчасові)

| Ключ                         | Значення    | TTL    | Призначення                       |
| ---------------------------- | ----------- | ------ | --------------------------------- |
| `magic:{token64}`            | email       | 15 min | Magic link token                  |
| `ratelimit:magic:{email}`    | count       | 15 min | Rate limit лічильник              |
| `refresh:{jti}`              | userId      | 7 days | Refresh token storage             |
| `refresh_family:{userId}`    | Set[jti]    | 7 days | Token family для reuse detection  |

### Report, Payment — **[НЕ РЕАЛІЗОВАНО]**

### Типи в packages/types

| Модуль                 | Зміст                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `constants/lang.ts`    | `LANG` object, `Lang` type                                                                                 |
| `enums/error-code.ts`  | `ERROR_CODE` (6 кодів), `ErrorCode` type                                                                   |
| `entities/user.ts`     | Zod: `UserSchema`, `UserProfileSchema`, `UserCreditsSchema`, `UserProviderSchema`, `UserProfileDataSchema` |
| `contracts/api.ts`     | `ApiErrorSchema`, `ApiError`, `ApiResponse<T>`                                                             |
| `contracts/auth.ts`    | `SendMagicLinkSchema`, `VerifyMagicLinkSchema`, `AuthResponseSchema` + types                               |
| `validation/common.ts` | `emailSchema`, `objectIdSchema`                                                                            |

## Module Dependency Map

### Backend (apps/api)

```
AppModule (root)
├── ConfigModule.forRoot() — глобальний
├── ThrottlerModule.forRoot() — 60 req/60s, ThrottlerGuard (global)
├── MongooseModule.forRoot() — MongoDB connection
├── AuthModule
│   ├── PassportModule
│   ├── JwtModule (JWT_ACCESS_SECRET, 1h)
│   ├── UsersModule (imported)
│   └── redisProvider (REDIS_CLIENT) + OnModuleInit/Destroy lifecycle
│   → exports: AuthService, REDIS_CLIENT
├── UsersModule
│   └── MongooseModule.forFeature(User)
│   → exports: UsersService
├── ReportsModule — skeleton
├── StorageModule — skeleton (no controller)
└── PaymentsModule — skeleton
```

**Крос-модульні залежності:**

- `AuthModule` → `UsersModule` (findOrCreate users)

### Frontend (apps/web)

```
layout.tsx
├── Providers (next-themes ThemeProvider)
├── NextIntlClientProvider (i18n)
├── AuthInitializer (silent token refresh on load)
├── Header (widget)
│   ├── Logo (entity/brand) — wrapped in Link to home
│   ├── User info / SignIn button (auth-aware)
│   ├── Logout button (auth-aware)
│   ├── ChangeTheme (feature, dynamic import ssr:false) → next-themes
│   └── ChangeLang (feature) → next-intl routing
└── {children} — pages

middleware.ts
├── i18n middleware (next-intl createIntlMiddleware)
├── Protected paths: /check, /pay → redirect to /auth/signin if no bid_refresh cookie
└── Auth paths: /auth/signin → redirect to /check if bid_refresh cookie exists
```

### Cross-package

- `apps/web` → `packages/types` (workspace dependency, tsconfig paths)
- `apps/api` → `packages/types` (workspace dependency, symlink → dist/)

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

- `JwtAuthGuard` — перевіряє Bearer token (JWT strategy)
- `@CurrentUser()` — витягує `request.user`

### Auth flow (Google OAuth)

1. Client → `GET /api/auth/google` → Google consent screen
2. Google → `GET /api/auth/google/callback` → AuthService.handleGoogleAuth()
3. API sets `bid_refresh` cookie → redirect to `{WEB_URL}/auth/callback`
4. Web callback page: `refreshToken()` → `getMe()` → update store → redirect to `/check`

### Auth flow (Magic Link)

1. Client → `POST /api/auth/magic-link/send` { email }
2. API generates 32-byte hex token → stores in Redis (15min TTL) → sends HTML email via Resend
3. User clicks link → `GET {WEB_URL}/auth/verify?token=XXX`
4. Web verify page → `POST /api/auth/magic-link/verify` { token }
5. API verifies → sets `bid_refresh` cookie → returns `{ user, accessToken }`

### Token refresh (auto)

Файл: `apps/web/src/shared/api/client.ts`

- Access token в пам'яті (closure variable, НЕ localStorage)
- Axios interceptor: на 401 → `POST /auth/refresh` (cookie) → retry original request
- Дедуплікація concurrent refresh requests через promise sharing
- Excluded endpoints: refresh та logout НЕ retry на 401

### Refresh token rotation

Файл: `apps/api/src/modules/auth/auth.service.ts`

- **Grace period 10s**: старий token позначається як `rotated` замість видалення — для concurrent tabs
- **Reuse detection**: якщо jti не знайдено в Redis → `revokeAllUserTokens()` (security)
- `refresh_family:{userId}` — Set всіх активних jti для масової revoke

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
- Polymorphic UiButton: `as="button"` | `as="link"` (Next.js Link) | `as="a"`
- Компоненти: UiButton, UiInput, UiSelect (Headless UI Listbox), UiSwitch, UiSpinner

### Bootstrap pattern (API)

Файл: `apps/api/src/main.ts`

- `void bootstrap()` — НЕ `.catch()`, НЕ `.finally()`
- Порядок: cookie-parser → globalPrefix `/api` → ZodValidationPipe → AllExceptionsFilter → CORS → listen
- CORS: localhost:3000 + ENV.WEB_URL, credentials: true
- Listen на `0.0.0.0` для Docker
- Logger: production (error/warn/log), dev (+debug/verbose)

### CSS Theme System

Файл: `apps/web/src/shared/styles/themes.css`

- CSS custom properties для кольорів: `--primary`, `--background`, `--surface`, `--border`, `--text-primary`, `--text-secondary`, `--success`, `--warning`, `--error`
- Light: `:root`, Dark: `.dark` selector
- Tailwind інтеграція через `@theme inline` директиву (TailwindCSS 4.x)
- Custom dark variant: `@custom-variant dark (&:where(.dark, .dark *))`

### SEO metadata

Файл: `apps/web/src/shared/seo/metadata.ts`

- `fetchMetadata()` — динамічно завантажує переклади з `messages/{locale}.json`
- Генерує canonical URL, hreflang alternates (x-default, uk-ua, en-ua)
- Використовується через `generateMetadata()` в кожному page component

## API Overview

Prefix: `/api` (global). Rate limit: 60 req/60s (ThrottlerGuard).

### Auth (`/api/auth`)

| Method | Path                          | Auth     | Опис                                                       |
| ------ | ----------------------------- | -------- | ---------------------------------------------------------- |
| GET    | `/api/auth/google`            | Passport | Redirect до Google consent                                 |
| GET    | `/api/auth/google/callback`   | Passport | OAuth callback → set cookie → redirect to WEB_URL          |
| POST   | `/api/auth/magic-link/send`   | —        | Відправка magic link на email (rate limit: 3/15min)        |
| POST   | `/api/auth/magic-link/verify` | —        | Верифікація token → set cookie → return user + accessToken |
| POST   | `/api/auth/refresh`           | Cookie   | Ротація refresh token (grace period 10s)                   |
| POST   | `/api/auth/logout`            | —        | Очистка refresh cookie                                     |

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
- Завантажує `.env` з monorepo root (`../../.env`) через dotenv override
- next-intl plugin інтеграція

## Common Commands

```bash
# Development
pnpm dev                                              # Всі apps через Turborepo (Turbopack for web)
pnpm build                                            # Build all
pnpm lint                                             # Lint all
pnpm format                                           # Prettier format

# API тести
pnpm --filter api test                                # Unit тести
pnpm --filter api test:watch                          # Watch mode
pnpm --filter api test:e2e                            # E2E тести
pnpm --filter api test:cov                            # Coverage

# Docker
docker compose -f docker-compose.dev.yml up --build   # Dev: local MongoDB + Redis
docker compose up --build -d                          # Prod: MongoDB Atlas

# packages/types
pnpm --filter @lucidkit/types build                   # Compile to CJS in dist/
```

## Rules & Conventions

- **TypeScript strict mode** увімкнений в обох apps
- API lint: no `any`, no floating promises, async requires await
- `main.ts` використовує `void bootstrap()` — не `.finally()`
- Mongoose schemas потребують `!` (definite assignment) на всіх `@Prop()` полях
- `@/widgets/header` exports `{ Header }` (named, re-exported from default)
- Cookie для refresh token: `bid_refresh`, httpOnly, secure (prod), sameSite=lax, path=/, maxAge=7d
- Frontend: Feature-Sliced Design (`app/`, `features/`, `entities/`, `widgets/`, `shared/`)
- UI компоненти: `Component.tsx` + `types.ts` + `index.ts` структура
- Шрифт: Google Fonts Mulish (300, 400, 700; subsets: cyrillic, latin)
- Locales: `uk` (default), `en`
- Theme: next-themes (attribute: class, storageKey: theme, defaultTheme: system)
- **Zod = single source of truth**: схеми в `packages/types`, types через `z.infer`, валідація на API і Web
- DTOs на API: `createZodDto(ZodSchema)` з `nestjs-zod` (НЕ class-validator)
- API response format: `{ data: {...} }` для success, `{ error: { code, message } }` для errors
- Access token: в пам'яті (closure), refresh token: httpOnly cookie
- Zustand stores без Provider — працюють напряму
- Prettier: singleQuote, tabWidth 4, trailingComma es5, semi true, printWidth 80
- Web: prettier-plugin-tailwindcss для сортування класів
- i18n message keys: `{page}_page.{section}.{key}` (welcome_page.head.title)
- Web path aliases: `@/*` → `./src/*`, `@lucidkit/types` → types source

## Known Complexities

### Theme — next-themes + dynamic import

Файл: `apps/web/src/features/change-theme/ChangeTheme.tsx`
`ChangeTheme` імпортується з `dynamic(..., { ssr: false })` у Header — уникає hydration mismatch. Компонент використовує `useTheme()` з `next-themes`. `providers.tsx` обгортає app у `ThemeProvider` з `attribute: class`.

### packages/types build order

`packages/types` МУСИТЬ бути зібраний до JS перед API/Web у Docker. `tsconfig.build.json` компілює в CJS у `dist/`. **НІКОЛИ** не додавати `paths: { "@lucidkit/types": [...] }` до API tsconfig — це ламає структуру output dir. API резолвить через workspace symlink → `dist/`. Web tsconfig МОЖЕ мати `paths` (Next.js використовує свій бандлер).

### In-memory access token

Файл: `apps/web/src/shared/api/client.ts`
Access token зберігається в closure variable (не localStorage) для безпеки. Axios interceptor автоматично додає Bearer header та дедуплікує concurrent refresh requests при 401 через shared promise.

### Auth initialization on app load

Файл: `apps/web/src/features/auth/AuthInitializer.tsx`
Компонент виконується один раз (useRef). Пробує `refreshToken()` → `getMe()` → оновлює store. `isLoading: true` в initial state запобігає flash signin button.

### Two-layer route protection

1. **Middleware** (server) — перевіряє `bid_refresh` cookie, швидкий redirect + i18n через createIntlMiddleware
2. **AuthGuard** (client) — перевіряє auth store, показує spinner поки loading

### Refresh token rotation security

Файл: `apps/api/src/modules/auth/auth.service.ts`
**Grace period (10s)**: При ротації старий jti позначається як `rotated` у Redis замість видалення. Якщо той самий старий token використовується протягом 10s (наприклад, concurrent tabs) — вважається легітимним.
**Reuse detection**: Якщо jti відсутній у Redis І НЕ є `rotated` → зловживання сесією → `revokeAllUserTokens()` видаляє всю `refresh_family`.

### Magic link rate limiting

Файл: `apps/api/src/modules/auth/auth.service.ts`
Redis-based: max 3 requests per email per 15min. Token: 64-byte hex (256-bit), TTL 15min.

### Suspense у verify page

Файл: `apps/web/src/app/[locale]/auth/verify/page.tsx`
`useSearchParams()` вимагає Suspense boundary у Next.js App Router. Verify page обгорнута у `<Suspense>` для читання `?token=` параметру.

### next.config.ts env loading

Файл: `apps/web/next.config.ts`
dotenv завантажує `.env` з monorepo root (`../../.env`) з override. Це дозволяє мати єдиний `.env` файл для всього проєкту. `NEXT_PUBLIC_*` змінні мають використовувати прямий `process.env.VAR` доступ для Next.js inlining.

### Docker dev polling

Файл: `docker-compose.dev.yml`
File watching в Docker потребує polling: `TSC_WATCHFILE=UsePolling` (API), `WATCHPACK_POLLING=true` + `CHOKIDAR_USEPOLLING=true` (Web). Build pipeline: `pnpm install → types build → app dev`.

### Known audit findings

Файл: `docs/audits/auth/auth-implementation-audit.md`
9 знахідок (1 critical, 4 high, 2 medium, 2 low). Ключові: magic-link не atomic (GET+DEL race), Google OAuth без state validation, E2E тести потребують мокування зовнішніх залежностей, rate-limit bypass через email variants.
