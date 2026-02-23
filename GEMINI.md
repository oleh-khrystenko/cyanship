# Gemini Project: LucidKit

This document provides a comprehensive overview of the LucidKit project, its structure, and development conventions to assist Gemini in understanding and contributing to the codebase.

## Project Overview

LucidKit is a monorepo project built with pnpm workspaces and managed by Turborepo. It consists of a web application and an API.

- **Web Application (`apps/web`):** A modern frontend built with Next.js 16 (using the App Router and React 19), styled with TailwindCSS 4, and utilizing Zustand for state management. It supports internationalization (i18n) with `next-intl`.

- **API (`apps/api`):** A robust backend powered by NestJS 11, using MongoDB with Mongoose for data persistence.

- **Shared Packages (`packages`):** The `packages` directory holds code shared across the monorepo, such as TypeScript types in `@lucidkit/types`.

The project is fully containerized with Docker, providing consistent development and production environments.

## Building and Running

The following commands are essential for working with the LucidKit project.

### Development

- **Run all applications in development mode:**

    ```bash
    pnpm dev
    ```

- **Build all applications:**
    ```bash
    pnpm build
    ```

### Linting and Formatting

- **Lint all applications:**

    ```bash
    pnpm lint
    ```

- **Format the entire codebase:**
    ```bash
    pnpm format
    ```

### Docker

- **Run the development environment (with a local MongoDB):**

    ```bash
    docker compose -f docker-compose.dev.yml up --build
    ```

    - Frontend: `http://localhost:3000`
    - Backend: `http://localhost:4000`

- **Run the production environment (requires MongoDB Atlas connection string in `.env`):**
    ```bash
    docker compose up --build -d
    ```

## Development Conventions

### Frontend (`apps/web`)

The frontend follows the **Feature-Sliced Design** methodology, organizing code into the following directories:

- `src/app`: Core application logic, routing, and layouts.
- `src/widgets`: Composite UI components (e.g., Header, Footer).
- `src/features`: Specific application features (e.g., authentication, settings).
- `src/entities`: Business-level entities and models.
- `src/shared`: Reusable code, including UI components, utilities, and configuration.

**UI Components:** Reusable UI components are located in `src/shared/ui` and are built using `class-variance-authority` for flexible styling.

**State Management:** Global state is managed with Zustand. Each feature has its own store in `src/stores` (e.g., `useSettingsStore`). No Provider wrapper needed.

**Styling:** The project uses TailwindCSS with a "light" and "dark" theme system. Theme variables are defined in `src/shared/styles/themes.css`.

### Backend (`apps/api`)

The backend follows the standard NestJS modular architecture. Core business logic is organized into modules within the `src/modules` directory.

**Configuration:** Environment variables are managed via the `@nestjs/config` module and accessed through the `ENV` object in `src/config/env.ts`.

### Shared Code

Code shared between the `web` and `api` applications, such as type definitions, is located in the `packages` directory. This promotes code reuse and consistency across the monorepo.

### Commits and Versioning

_TODO: Add information about commit message conventions and versioning strategy (e.g., Conventional Commits, Semantic Versioning)._
