# LucidShip
> Modern monorepo SaaS boilerplate with Next.js 16, NestJS 11, and Feature-Sliced Design.

## Tech Stack
- **Core:** TypeScript, Node.js, pnpm workspaces, Turborepo.
- **Frontend:** Next.js 16 (App Router), React 19, TailwindCSS 4, Zustand (state), next-intl (i18n), class-variance-authority (UI).
- **Backend:** NestJS 11, Mongoose (MongoDB), Redis (caching/rate-limiting), Passport.js (OAuth/JWT).
- **Communication:** Axios, Resend (email), Google OAuth.
- **Infra:** Docker, docker-compose.

## Architecture Overview
- **Monorepo:** Розділення на `apps/web`, `apps/api` та `packages/shared`.
- **Frontend (apps/web):** Feature-Sliced Design (FSD). Шари: `app`, `widgets`, `features`, `entities`, `shared`.
- **Backend (apps/api):** Modular NestJS. Кожен домен — окремий модуль.
- **Types (packages/types):** Single source of truth для типів, енамів та контрактів API.

## Project Structure
- `apps/web/src/app/[locale]` — Routing та Layouts (i18n enabled).
- `apps/web/src/features` — Бізнес-фічі (auth, profile).
- `apps/web/src/shared/ui` — Атомарні UI компоненти.
- `apps/api/src/modules` — Модулі бекенду (auth, users, payments, etc.).
- `apps/api/src/common` — Глобальні Guards, Filters, Decorators.
- `packages/types/src` — Спільні TypeScript дефініції.
- `docs/conventions` — Обов'язкові інженерні стандарти.

## Domain Model & Schema
- **User:** Основна сутність. Зберігає `email`, `profile` (name, avatar), `credits`, `passwordHash`, `deletedAt` (для soft delete), `preferredLang`.
- **Mongoose Schema:** `apps/api/src/modules/users/schemas/user.schema.ts`.
- **Types:** `packages/types/src/entities/user.ts`.

## Module Dependency Map
- `apps/web` → `@lucidship/types`
- `apps/api` → `@lucidship/types`
- `packages/types` → Standalone (Zod для валідації).

## Key Patterns (CodeDNA)
- **Створення Endpoint:** `apps/api/src/modules/users/users.controller.ts`
- **Валідація (DTO):** `apps/api/src/modules/auth/dto/login-password.dto.ts`
- **Auth Guard:** `apps/api/src/common/guards/jwt-auth.guard.ts`
- **Error Handling:** `apps/api/src/common/filters/all-exceptions.filter.ts`
- **Frontend Store:** `apps/web/src/stores/auth/authStore.ts`
- **Frontend Auth Guard:** `apps/web/src/features/auth/AuthGuard.tsx`
- **Environment Config:** `apps/api/src/config/env.ts` (Fail-fast policy).

## API Surface
### Auth Module (`/auth`)
- `GET /google`, `GET /google/callback` — OAuth.
- `POST /check-email` — Перевірка існування користувача.
- `POST /login/password` — Login за паролем.
- `POST /magic-link/send` — Відправка лінку для входу/реєстрації.
- `POST /magic-link/verify` — Верифікація токена.
- `POST /refresh`, `POST /logout` — Керування сесією.
- `POST /password/set`, `POST /password/change`, `POST /password/delete` — Керування паролем.

### Users Module (`/users`)
- `GET /me` — Профіль поточного користувача.
- `PATCH /me` — Оновлення профілю.
- `PATCH /me/lang` — Оновлення мови.
- `POST /account/delete`, `POST /account/delete/confirm` — Soft delete.
- `POST /account/restore` — Відновлення акаунту.

## Environment & Config
- **Backend:** `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_URL`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`.
- **Frontend:** `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`.
- **Policy:** Fail-fast (система крашиться при відсутності критичних змінних).

## Dev Workflow
- `pnpm dev` — Запуск усіх додатків локально.
- `pnpm build` — Build проекту.
- `pnpm lint`, `pnpm format` — Перевірка стилю.
- `docker compose -f docker-compose.dev.yml up` — Dev оточення в Docker.

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

## Known Complexities & Debt
- **Prisma Reference:** У секції `Rules` згадується `prisma/schema.prisma`, хоча проект використовує Mongoose. Це застаріла інструкція, яку слід ігнорувати або оновити при переході на Prisma.
- **Soft Delete Logic:** Реалізовано через `deletedAt` в `users.service.ts` з можливістю відновлення протягом `ACCOUNT_DELETION_GRACE_DAYS`.
- **I18n Sync:** Складна логіка синхронізації мови між Frontend (Next.js middleware) та Backend (`preferredLang` у користувача). Див. `docs/conventions/i18n.md`.
- **Tailwind 4:** Використання нової версії Tailwind з CSS-first конфігурацією (`apps/web/src/app/globals.css`).
