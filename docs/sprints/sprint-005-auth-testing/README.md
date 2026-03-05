# Sprint 005 — Auth Testing: повне покриття auth flow тестами

## Контекст

Після реалізації sprint-004 (password auth, progressive disclosure, account deletion, profile management) потрібно комплексне тестування всього auth flow. Цей спринт створює повне покриття: automated (unit + integration) та manual E2E тести.

Спринт покриває ВСЮ авторизацію — як існуючу (Google OAuth, Magic Link, Token Lifecycle з sprint-003), так і нову (Password Auth, Progressive Lockout, Magic Link Purpose, Password Management, Account Deletion, Profile).

## Документи

| Файл | Опис |
|------|------|
| [automated-tests.md](./automated-tests.md) | Service prompt для AI агента: створення unit, e2e та frontend тестів |
| [manual-test-plan.md](./manual-test-plan.md) | Покрокові сценарії для ручного тестування з чеклистами |

## Scope

### automated-tests.md

Service prompt для AI агента (Claude Code). Описує що тестувати, а не як — агент сам читає кодову базу та пише тести.

- **Backend unit тести:** auth.service, users.service, email.service, auth.controller (новий), users.controller (новий)
- **Backend e2e тести:** всі auth + users endpoints, rate limiting, cookies, error format
- **Frontend unit тести:** axios interceptors, auth API functions, Zustand store, AuthGuard, AuthInitializer, middleware

### manual-test-plan.md

- **A. Auth Flows** — Google OAuth, Magic Link (5 scenarios), Progressive Disclosure
- **B. Password Auth** — login, progressive lockout, forgot password, show/hide toggle
- **C. Token Lifecycle** — access/refresh expiry, rotation, grace period, reuse detection
- **D. Route Protection** — protected/public/auth routes, middleware
- **E. Session Management** — logout, session persistence, concurrent refresh dedup
- **F. Profile** — new user, set/change/delete password, session invalidation
- **G. Account Deletion** — with password, with magic link, recovery
- **H. Email Templates** — 5 templates x 2 languages
- **I. Security** — anti-spam dedup, check-email rate limit, IP+email lockout

## Залежності

Sprint 005 виконується після повної реалізації sprint-004 (всі 7 фаз).

## Verification

1. `pnpm --filter @lucidship/types build` — types компілюються
2. `pnpm --filter api test` — всі backend unit тести pass
3. `pnpm --filter api test:e2e` — всі backend e2e тести pass
4. `pnpm --filter web test` — всі frontend unit тести pass
5. `pnpm build` — повний build без помилок
6. Manual: пройти весь чеклист з manual-test-plan.md
