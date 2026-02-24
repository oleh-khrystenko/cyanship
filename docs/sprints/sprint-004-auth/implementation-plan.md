# План імплементації: повне покриття auth-flow.md

## Огляд

8 фаз, кожна описана в окремому файлі. Деталі кожної фази — у відповідному `phase-N-*.md`.

## Фази

| # | Назва | Scope | Залежить від |
|---|---|---|---|
| 1 | [Foundation](./phase-1-foundation.md) | packages/types, User Schema, ENV, bcrypt | — |
| 2 | [Password Auth](./phase-2-password-auth.md) | check-email, login/password, brute force | 1 |
| 3 | [Magic Link Purpose](./phase-3-magic-link-purpose.md) | Redis purpose context, email templates | 1 |
| 4 | [Password Management](./phase-4-password-management.md) | set/change/delete/verify password | 2, 3 |
| 5 | [Account Deletion](./phase-5-account-deletion.md) | soft delete, recovery, confirmation | 4 |
| 6 | [Frontend Signin](./phase-6-frontend-signin.md) | progressive disclosure, API functions | 2, 3 |
| 7 | [Frontend Profile](./phase-7-frontend-profile.md) | profile page, security, danger zone | 4, 5, 6 |
| 8 | [Tests + QA](./phase-8-tests.md) | unit, E2E, manual testing | 7 |

## Граф залежностей

```
Фаза 1 (Foundation)
  ├─→ Фаза 2 (Password Auth)      ─┐
  └─→ Фаза 3 (Magic Link Purpose)  ─┤
        └─→ Фаза 4 (Password Mgmt) ───── залежить від 2 + 3
              └─→ Фаза 5 (Account Deletion)
  ├─→ Фаза 6 (Frontend Signin) ─── залежить від 2 + 3
  │     └─→ Фаза 7 (Frontend Profile) ─── залежить від 4 + 5 + 6
  │           └─→ Фаза 8 (Тести + QA)
```

Фази 2 і 3 можна робити паралельно після Фази 1.

## Нові файли (орієнтовно)

### packages/types
- `src/validation/common.ts` — edit (додати `passwordSchema`)
- `src/contracts/auth.ts` — edit (нові схеми + types)
- `src/entities/user.ts` — edit (hasPassword, deletedAt)
- `src/enums/error-code.ts` — edit (ACCOUNT_DELETED)

### apps/api
- `src/config/env.ts` — edit (AUTH_LOCKOUT_THRESHOLDS, AUTH_LOGIN_ATTEMPTS_TTL_MIN, AUTH_MAGIC_LINK_DEDUP_SEC, ACCOUNT_DELETION_GRACE_DAYS)
- `src/modules/users/schemas/user.schema.ts` — edit (passwordHash, deletedAt)
- `src/modules/users/users.controller.ts` — edit (PATCH /me, account endpoints)
- `src/modules/users/users.service.ts` — edit (password + account methods)
- `src/modules/auth/auth.controller.ts` — edit (нові endpoints)
- `src/modules/auth/auth.service.ts` — edit (password auth, brute force, purpose)
- `src/modules/auth/services/email.service.ts` — edit (5 templates)
- `src/modules/auth/dto/check-email.dto.ts` — new
- `src/modules/auth/dto/login-password.dto.ts` — new
- `src/modules/auth/dto/set-password.dto.ts` — new
- `src/modules/auth/dto/change-password.dto.ts` — new
- `src/modules/auth/dto/verify-password.dto.ts` — new

### apps/web
- `src/app/[locale]/auth/signin/page.tsx` — edit (progressive disclosure)
- `src/app/[locale]/auth/verify/page.tsx` — edit (purpose routing)
- `src/app/[locale]/(protected)/profile/page.tsx` — new
- `src/features/profile/ProfileForm.tsx` — new
- `src/features/profile/SecuritySection.tsx` — new
- `src/features/profile/DangerZone.tsx` — new
- `src/features/profile/DeleteAccountModal.tsx` — new
- `src/features/profile/index.ts` — new
- `src/shared/api/auth.ts` — edit (нові API functions)
- `src/middleware.ts` — edit (/profile до protected)
- `messages/uk.json` — edit (нові ключі)
- `messages/en.json` — edit (нові ключі)

## Verification

1. `pnpm --filter @lucidkit/types build` — types компілюються
2. `pnpm --filter api test` — всі unit тести pass
3. `pnpm --filter api test:e2e` — E2E тести pass
4. `pnpm build` — повний build без помилок
5. Manual testing всіх сценаріїв
