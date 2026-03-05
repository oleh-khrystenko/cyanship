# Lucid Ship

Production-ready SaaS boilerplate — все, що потрібно для швидкого запуску web-додатка: auth, payments, i18n, theming та модульна архітектура з коробки.

---

## Структура проєкту

```
lucid-ship/
├── apps/
│   ├── web/                  # Frontend (Next.js 16, React 19)
│   └── api/                  # Backend (NestJS 11)
├── packages/
│   └── types/                # Shared Zod-схеми, типи, контракти (@lucidship/types)
├── docs/                     # Документація, аудити, спринти
├── docker-compose.yml        # Production (api + web)
├── docker-compose.dev.yml    # Development (mongo + redis + api + web)
├── turbo.json                # Build pipeline
├── pnpm-workspace.yaml       # Workspaces: apps/*, packages/*
└── package.json              # Root scripts
```

---

## Технології

| Шар       | Технологія                          |
| --------- | ----------------------------------- |
| Monorepo  | Turborepo + pnpm workspaces         |
| Frontend  | Next.js (App Router), React, Zustand, TailwindCSS, next-intl, next-themes |
| Backend   | NestJS, Mongoose (MongoDB), Passport (JWT + Google OAuth), ioredis |
| Shared    | Zod (валідація), TypeScript (strict) |
| Email     | Resend                              |

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

# MongoDB
MONGODB_URI=mongodb://mongo:27017    # dev (docker-compose.dev)

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Redis
REDIS_URL=redis://redis:6379         # dev (docker-compose.dev)

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback

# Resend
RESEND_API_KEY=your-resend-api-key

# Web
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### 2. Запуск для розробки

```bash
docker compose -f docker-compose.dev.yml up --build
```

| Сервіс   | URL / Порт                          |
| -------- | ----------------------------------- |
| Frontend | http://localhost:3000                |
| Backend  | http://localhost:4000                |
| MongoDB  | localhost:27017                      |
| Redis    | localhost:6379                       |

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

| Команда                                  | Опис                        |
| ---------------------------------------- | --------------------------- |
| `pnpm dev`                               | Dev-сервери через Turborepo |
| `pnpm build`                             | Build all                   |
| `pnpm lint`                              | Lint all                    |
| `pnpm format`                            | Prettier format             |
| `pnpm --filter api test`                 | API unit тести              |
| `pnpm --filter api test:e2e`             | API E2E тести               |
| `pnpm --filter api test:cov`             | API coverage                |
| `pnpm --filter @lucidship/types build`    | Build shared types          |
