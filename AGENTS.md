# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm/Turborepo monorepo. Primary locations:

- `apps/web/` — Next.js frontend (App Router, `src/app/[locale]/` for pages and i18n).
- `apps/api/` — NestJS backend (`src/modules/` for feature modules).
- `packages/types/` — Shared TypeScript types (`@bidguard/types`).
- Root configs: `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.prettierrc`.

Frontend follows Feature-Sliced Design in `apps/web/src/`:

- `features/`, `entities/`, `widgets/`, `shared/ui/`, `shared/lib/`, `shared/icons/`, `stores/`.

## Build, Test, and Development Commands

Run from repo root:

- `pnpm dev` — Start all apps in dev mode via Turborepo.
- `pnpm build` — Build all apps.
- `pnpm lint` — Lint all apps.
- `pnpm format` — Format with Prettier.

API-specific testing:

- `pnpm --filter api test` — Unit tests.
- `pnpm --filter api test:watch` — Watch mode.
- `pnpm --filter api test:e2e` — End-to-end tests.
- `pnpm --filter api test:cov` — Coverage run.

Docker (optional):

- `docker compose -f docker-compose.dev.yml up --build` — Dev with local MongoDB.
- `docker compose up --build -d` — Production-style run (Atlas).

## Coding Style & Naming Conventions

- Language: TypeScript across apps and packages.
- Formatting: Prettier (`pnpm format`). ESLint runs via `pnpm lint`.
- UI components in `apps/web/src/shared/ui/` follow: `Component.tsx`, `types.ts`, `index.ts`, `README.md`.
- Keep naming consistent with existing modules (e.g., `UiButton`, `UiSelect`).

## Testing Guidelines

- Run API tests with `pnpm --filter api test` before PRs.
- Use `test:cov` for coverage-sensitive changes.
- Keep test files near related modules under `apps/api/src/`.

## Commit & Pull Request Guidelines

- Git history is not available in this workspace, so no commit convention can be inferred.
- Use concise, imperative commit summaries (e.g., `add api kv module`).
- PRs should include:
    - Clear description of behavior changes.
    - Linked issues/tickets if applicable.
    - Screenshots for UI changes (web).
    - Notes on env/config updates (e.g., `.env` keys).

## Configuration & Environment

Root `.env` should define at least:

- `WEB_PORT`, `API_PORT`, `MONGODB_URI` or `MONGODB_DB_NAME`,
- `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_URL`.

If you add new env keys, update documentation and sample config.
