# Sprint 004 — Auth: повне покриття auth-flow.md

## Контекст

Специфікація `docs/planning/auth-flow.md` (714 рядків) описує повний auth flow: progressive disclosure, password auth, forgot password, profile management, account deletion з grace period, account recovery. Поточна реалізація покриває лише Google OAuth + Magic Link (без purpose context). Цей спринт закриває всі gaps між специфікацією та кодом.

## Документи

| Файл | Опис |
|------|------|
| [gap-analysis.md](./gap-analysis.md) | Детальний аналіз: що реалізовано vs що потрібно |
| [implementation-plan.md](./implementation-plan.md) | Покроковий план імплементації (8 фаз) |
| [phase-1-foundation.md](./phase-1-foundation.md) | Фаза 1: packages/types + User Schema + ENV + bcrypt |
| [phase-2-password-auth.md](./phase-2-password-auth.md) | Фаза 2: check-email + password login + brute force |
| [phase-3-magic-link-purpose.md](./phase-3-magic-link-purpose.md) | Фаза 3: Magic Link purpose context + email templates |
| [phase-4-password-management.md](./phase-4-password-management.md) | Фаза 4: set/change/delete/verify password |
| [phase-5-account-deletion.md](./phase-5-account-deletion.md) | Фаза 5: Account Deletion + Recovery |
| [phase-6-frontend-signin.md](./phase-6-frontend-signin.md) | Фаза 6: Progressive Disclosure (Signin) |
| [phase-7-frontend-profile.md](./phase-7-frontend-profile.md) | Фаза 7: Profile Page |
| [phase-8-tests.md](./phase-8-tests.md) | Фаза 8: Тести + QA |

## Порядок виконання

```
Фаза 1 (Foundation)
  └─→ Фаза 2 (Password Auth)     ─┐
  └─→ Фаза 3 (Magic Link Purpose) ─┤
        └─→ Фаза 4 (Password Mgmt)  ─── залежить від 2 + 3
              └─→ Фаза 5 (Account Deletion) ─── залежить від 4
  └─→ Фаза 6 (Frontend Signin) ─── залежить від 2 + 3
        └─→ Фаза 7 (Frontend Profile) ─── залежить від 4 + 5 + 6
              └─→ Фаза 8 (Тести) ─── після всіх фаз
```

Фази 2 і 3 можна робити паралельно після Фази 1.

## Verification

1. `pnpm --filter @lucidkit/types build` — types компілюються
2. `pnpm --filter api test` — всі unit тести pass
3. `pnpm --filter api test:e2e` — E2E тести pass
4. `pnpm build` — повний build без помилок
5. Manual testing: пройти всі сценарії з `docs/sprints/sprint-003-auth/manual-e2e-auth-test-plan.md` + нові сценарії
