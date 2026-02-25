# Sprint 005 — Auth Testing: повне покриття auth flow тестами

## Контекст

Після реалізації sprint-004 (password auth, progressive disclosure, account deletion, profile management) потрібно комплексне тестування всього auth flow. Цей спринт створює повне покриття: automated (unit + integration) та manual E2E тести.

Спринт покриває ВСЮ авторизацію — як існуючу (Google OAuth, Magic Link, Token Lifecycle з sprint-003), так і нову (Password Auth, Progressive Lockout, Magic Link Purpose, Password Management, Account Deletion, Profile).

## Документи

| Файл | Опис |
|------|------|
| [automated-tests.md](./automated-tests.md) | Unit + Integration тести: describe/it блоки, мокування, assertions |
| [manual-test-plan.md](./manual-test-plan.md) | Покрокові сценарії для ручного тестування з чеклистами |

## Scope

### automated-tests.md

- **Unit тести (apps/api):**
  - `auth.service.spec.ts` — checkEmail, loginWithPassword, progressive lockout, magic link з purpose, anti-spam dedup, password management (set/change/delete/verify), session invalidation, account deletion
  - `users.service.spec.ts` — password hash methods, soft delete, restore, updateProfile
  - `email.service.spec.ts` — templates per purpose + lang, deletion confirmation
- **Integration/E2E тести (apps/api):**
  - Всі auth endpoints (check-email, login/password, magic-link/send, magic-link/verify, password/*, refresh, logout)
  - Users endpoints (GET /me, PATCH /me, account/delete, account/restore)
  - Cross-cutting: rate limiting, cookie handling, error responses

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

1. `pnpm --filter @lucidkit/types build` — types компілюються
2. `pnpm --filter api test` — всі unit тести pass
3. `pnpm --filter api test:e2e` — всі integration тести pass
4. `pnpm build` — повний build без помилок
5. Manual: пройти весь чеклист з manual-test-plan.md
