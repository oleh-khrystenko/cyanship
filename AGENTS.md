# Repository Guidelines

## Project Structure & Module Organization
This repo is a Turborepo monorepo with application code under `apps/` and shared packages under `packages/`. The main apps are `apps/web` (Next.js frontend) and `apps/api` (NestJS backend). Shared UI/components and types live in `packages/shared` and `packages/types`. Root-level configs include `turbo.json`, `tsconfig.json`, and Prettier settings in `.prettierrc`. Docker workflows are defined in `docker-compose.dev.yml` and `docker-compose.yml`.

## Build, Test, and Development Commands
- `pnpm dev` runs all dev servers via Turbo.
- `pnpm build` builds all packages/apps.
- `pnpm lint` runs lint tasks across the workspace.
- `pnpm format` formats the repo with Prettier.
App-specific examples:
- `pnpm --filter web dev` runs the Next.js dev server.
- `pnpm --filter api start:dev` runs the NestJS API in watch mode.
Docker workflows:
- `docker compose -f docker-compose.dev.yml up --build` starts local dev with Mongo.
- `docker compose up --build -d` starts production-style containers.

## Coding Style & Naming Conventions
Prettier enforces 4-space indentation, single quotes, semicolons, and 80-column lines. Use `pnpm format` before pushing. ESLint runs in both apps. Tailwind class sorting is enabled for `apps/web` via `prettier-plugin-tailwindcss`. Use `.spec.ts` for unit tests and `.e2e-spec.ts` for end-to-end tests.

## Testing Guidelines
The API uses Jest (unit and e2e). Run:
- `pnpm --filter api test` for unit tests.
- `pnpm --filter api test:e2e` for end-to-end tests.
No frontend test harness is configured yet; add one only if requirements emerge.

## Commit & Pull Request Guidelines
There is only an initial commit in history, so no formal commit convention exists. Keep messages short and imperative (e.g., “add api health check”). PRs should describe the change, include relevant commands run (e.g., `pnpm lint`), and add screenshots for UI changes. Link related issues when applicable.

## Configuration Notes
Create a root `.env` file for Docker runs (see `README.md` for example values). Do not commit secrets; keep environment-specific values local.
