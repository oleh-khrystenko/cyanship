# CyanShip

Production-ready SaaS-бойлерплейт та одночасно живий лендінг агенції — все, що потрібно для швидкого запуску web-додатка: auth, payments, i18n, theming та модульна архітектура з коробки.

При старті нового проекту робиться форк репозиторію, видаляється модуль agency, і розробка клієнтського продукту починається поверх готового ядра. Детальніше: [docs/vision/product.md](docs/vision/product.md), порядок видалення agency: [docs/conventions/modular-boundaries.md](docs/conventions/modular-boundaries.md).

---

## Архітектура

Turborepo-монорепозиторій з жорстким розділенням на два шари:

- **Core** — авторизація, користувачі, платежі, shared UI, валідація, i18n. Стабільне ядро, що повторно використовується в кожному проекті.
- **Agency** — бізнес-логіка агенції (лендінг, лід-магніти). Ізольований модуль, який видаляється за 15 хвилин при форку.

Одностороння залежність: Agency -> Core, ніколи навпаки (enforced ESLint).

---

## Структура проєкту

```
cyanship/
├── apps/
│   ├── web/                  # Frontend (Next.js 16, React 19)
│   │   └── src/
│   │       ├── app/[locale]/
│   │       │   ├── auth/             # Signin, callback, verify
│   │       │   ├── (protected)/      # Profile, billing
│   │       │   └── (agency)/         # Agency pages (scaffold)
│   │       ├── features/             # Auth, profile, change-lang, change-theme
│   │       ├── entities/             # Brand, agency (scaffold)
│   │       ├── widgets/              # Header
│   │       └── shared/               # API client, UI, config, styles, i18n
│   └── api/                  # Backend (NestJS 11)
│       └── src/
│           ├── modules/
│           │   ├── auth/             # Google OAuth, Magic Link, Password, JWT
│           │   ├── users/            # CRUD, profile, soft-delete, executions
│           │   ├── payments/         # Stripe subscriptions + one-off credit packs
│           │   ├── agency/           # Agency module (scaffold)
│           │   ├── reports/          # Skeleton
│           │   └── storage/          # Skeleton
│           └── common/               # Guards, filters, decorators, Redis provider
├── packages/
│   └── types/                # @cyanship/types — Zod-схеми, типи, контракти
│       └── src/
│           ├── index.ts              # Core exports
│           └── agency.ts             # Agency exports (окремий entry point)
├── docs/                     # Vision, planning, testing, conventions
├── compose.yaml              # Production (api + web)
├── docker-compose.dev.yml    # Development (mongo + redis + api + web)
├── turbo.json                # Build pipeline
└── pnpm-workspace.yaml       # Workspaces: apps/*, packages/*
```

---

## Технології

| Шар        | Технологія                                                                      |
| ---------- | ------------------------------------------------------------------------------- |
| Monorepo   | Turborepo + pnpm workspaces                                                    |
| Frontend   | Next.js 16 (App Router), React 19, Zustand, TailwindCSS 4, next-intl, next-themes |
| Backend    | NestJS 11, Mongoose (MongoDB), Passport (JWT + Google OAuth), ioredis (Redis)   |
| Payments   | Stripe (subscriptions + one-off credit packs, webhook idempotency)              |
| Shared     | Zod 4 (single source of truth), TypeScript 5.9 (strict)                        |
| Email      | Resend                                                                          |
| Тести      | Jest 30, Supertest, MongoMemoryServer                                           |

---

## Що реалізовано

- **Auth**: Google OAuth, Magic Link, Password login, brute force protection, token rotation з reuse detection
- **Users**: Profile management, preferred language, account soft-delete з 30-day grace period, scheduled cleanup
- **Payments**: Stripe subscriptions, one-off credit packs, two-phase webhook idempotency, billing portal
- **i18n**: uk/en, server + client, email templates двома мовами
- **Theming**: Light / Dark / System (next-themes)
- **UI**: Feature-Sliced Design, Headless UI, Radix, polymorphic components

---

## Швидкий старт

### Вимоги

- **Docker** + **Docker Compose**

### 1. Створи файл `.env` у корені

```env
# Обов'язкові
NODE_ENV=development
WEB_PORT=3000
API_PORT=4000

# Origin сайту — використовується і бекендом, і фронтом
WEB_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://mongo:27017

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Redis
REDIS_URL=redis://redis:6379

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Resend
RESEND_API_KEY=your-resend-api-key

# Stripe
# Price ID тут немає: ціни, кількість executions і порядок відображення
# читаються з metadata Stripe Products через CatalogService
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Web
API_INTERNAL_URL=http://localhost:4000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

Решта (Turnstile, Anthropic, R2) — у [.env.example](.env.example). Origin сайту (`WEB_URL`) і базу медіа (`R2_PUBLIC_URL`) задаєш один раз: `next.config.ts` інлайнить їх у фронтовий бандл як `NEXT_PUBLIC_BASE_URL` і `NEXT_PUBLIC_STORAGE_URL`. Окремих web-копій цих значень немає. Шлях до API теж не змінна — це константа `/api` (`apps/web/src/shared/config/api.ts`), бо refresh-cookie вимагає same-origin проксі.

Повний список змінних: [apps/api/src/config/env.ts](apps/api/src/config/env.ts), [apps/web/src/shared/config/env.ts](apps/web/src/shared/config/env.ts).

Ліміти, TTL, пороги і feature-прапорці змінними середовища **не є** — вони однакові в усіх середовищах і живуть у коді (`packages/types/src/constants/`, або локальна константа модуля). Правило: [docs/conventions/fail-fast.md](docs/conventions/fail-fast.md).

### 2. Запуск для розробки

```bash
docker compose -f docker-compose.dev.yml up --build
```

| Сервіс   | URL / Порт             |
| -------- | ---------------------- |
| Frontend | http://localhost:3000   |
| Backend  | http://localhost:4000   |
| MongoDB  | localhost:27017         |
| Redis    | localhost:6379          |

Зупинити:

```bash
docker compose -f docker-compose.dev.yml down
```

### 3. Запуск для production

1. У `.env` вкажи реальний MongoDB Atlas URI та інші production credentials.
2. Запусти:

```bash
docker compose up --build -d
```

---

## Скрипти

| Команда                                   | Опис                        |
| ----------------------------------------- | --------------------------- |
| `pnpm dev`                                | Dev-сервери через Turborepo |
| `pnpm build`                              | Build all                   |
| `pnpm lint`                               | Lint all                    |
| `pnpm format`                             | Prettier format             |
| `pnpm test`                               | Test all via Turborepo      |
| `pnpm --filter api test`                  | API unit тести              |
| `pnpm --filter api test:e2e`              | API E2E тести               |
| `pnpm --filter api test:cov`              | API coverage                |
| `pnpm --filter web test`                  | Web unit тести              |
| `pnpm --filter @cyanship/types build`    | Build shared types          |

---

## Документація

- [Vision & Product](docs/vision/product.md) — опис проекту, бізнес-модель, позиціонування (видаляється при форку)
- [Conventions](docs/conventions/README.md) — правила та конвенції для розробки
- [Architecture](docs/architecture/README.md) — опис реалізованих підсистем (auth, payments)
- [Testing](docs/testing/) — тестові плани (auth, payments)
