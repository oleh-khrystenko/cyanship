# Sprint 004 — Auth: повне покриття auth-flow.md

## Контекст

Специфікація `docs/planning/auth-flow.md` описує повний auth flow: progressive disclosure, password auth, forgot password, profile management, account deletion з grace period, account recovery. Поточна реалізація покриває лише Google OAuth + Magic Link (без purpose context). Цей спринт закриває всі gaps між специфікацією та кодом.

### Ключові зміни після ревізії auth-flow.md

- **Progressive lockout** замість фіксованих 100 спроб: 5→1хв, 10→5хв, 20→15хв (`AUTH_LOCKOUT_THRESHOLDS`)
- **IP+email ключ** для brute force (`login_attempts:{ip}:{email}`) — захист від DoS
- **Інвалідація сесій** при зміні/скиді пароля (`revokeAllUserTokens()`)
- **Однакова відповідь** forgot password — запобігає user enumeration
- **Show/hide toggle** для паролів замість поля "Підтвердити пароль"
- **"Змінити email"** на кроці пароля — UX покращення
- **Anti-spam дедуплікація** magic link (< 60s → не відправляє повторний email)
- **Rate limit check-email** — per-IP, 10 req/min

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

> **Тестування:** Винесено в окремий спринт — [sprint-005-auth-testing](../sprint-005-auth-testing/README.md) (unit + integration + manual E2E).

## Порядок виконання

```
Фаза 1 (Foundation)
  └─→ Фаза 2 (Password Auth)     ─┐
  └─→ Фаза 3 (Magic Link Purpose) ─┤
        └─→ Фаза 4 (Password Mgmt)  ─── залежить від 2 + 3
              └─→ Фаза 5 (Account Deletion) ─── залежить від 4
  └─→ Фаза 6 (Frontend Signin) ─── залежить від 2 + 3
        └─→ Фаза 7 (Frontend Profile) ─── залежить від 4 + 5 + 6
              └─→ Sprint 005 (Тестування) ─── після всіх фаз
```

Фази 2 і 3 можна робити паралельно після Фази 1.

## Verification

1. `pnpm --filter @lucidkit/types build` — types компілюються
2. `pnpm --filter api test` — всі unit тести pass
3. `pnpm --filter api test:e2e` — E2E тести pass
4. `pnpm build` — повний build без помилок
5. Manual testing: пройти всі сценарії з `docs/sprints/sprint-003-auth/manual-e2e-auth-test-plan.md` + нові сценарії
