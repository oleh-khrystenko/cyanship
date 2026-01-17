# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

**Root commands (Turborepo orchestration):**
```bash
pnpm dev              # Run all apps in development mode
pnpm build            # Build all workspaces
pnpm lint             # Lint all workspaces
pnpm format           # Format code with Prettier
```

**Docker development (recommended):**
```bash
docker compose -f docker-compose.dev.yml up --build   # Starts web, api, and local MongoDB
```

**Filter to specific workspace:**
```bash
pnpm --filter ./apps/web dev
pnpm --filter ./apps/api test
pnpm --filter ./apps/api test:watch
pnpm --filter ./apps/api test:e2e
```

## Architecture

This is a pnpm monorepo with Turborepo orchestration containing:

- **apps/web**: Next.js 16 frontend with React 19, Turbopack, next-intl for i18n (uk/en locales), next-themes for theming, Zustand for state, Tailwind CSS v4
- **apps/api**: NestJS 11 backend with Mongoose/MongoDB, modular architecture (modules/controllers/services pattern)
- **packages/types**: Shared TypeScript type definitions (@acw/types)
- **packages/shared**: Shared utilities (@acw/shared)

**Path aliases:**
- Web: `@/*` → `./src/*`, `@shared/*` → `packages/shared`, `@acw/types`
- API: `@shared/*` → `packages/shared`

**Key patterns:**
- App Router with dynamic `[locale]` segments for i18n routing
- Feature-based organization in `apps/web/src/features/`
- Shared UI components in `apps/web/src/shared/ui/`
- Translation files in `apps/web/messages/{en,uk}.json`
- NestJS modules in `apps/api/src/modules/` (e.g., users module)

**Environment:**
- `WEB_PORT` (default 3000), `API_PORT` (default 3001)
- `MONGODB_URI`, `MONGODB_DB_NAME` for database
- `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL` for frontend API calls

## Code Style

- 4-space indentation (configured in .prettierrc)
- Single quotes, trailing commas (es5)
- Tailwind class sorting via prettier-plugin-tailwindcss
- ESLint: next/core-web-vitals for web, @typescript-eslint for api
