# Gap-аналіз: auth-flow.md vs поточна реалізація

## Що вже реалізовано (✅)

### Backend (apps/api)

| Компонент | Статус | Деталі |
|-----------|--------|--------|
| Google OAuth flow | ✅ | GET /auth/google, GET /auth/google/callback |
| Magic Link send | ✅ | POST /auth/magic-link/send (rate limit 3/15min) |
| Magic Link verify | ✅ | POST /auth/magic-link/verify (atomic GETDEL) |
| Token refresh | ✅ | POST /auth/refresh (rotation + grace period 10s) |
| Logout | ✅ | POST /auth/logout (revoke + clear cookie) |
| GET /users/me | ✅ | id, email, profile, credits, preferredLang |
| JWT strategy | ✅ | Bearer token extraction, user lookup |
| Google strategy | ✅ | passport-google-oauth20, email + profile |
| AllExceptionsFilter | ✅ | Global error handler → ERROR_CODE mapping |
| ZodValidationPipe | ✅ | Global Zod validation |
| ThrottlerGuard | ✅ | 60 req/60s global |
| Redis provider | ✅ | REDIS_CLIENT token |
| Email service | ✅ | 1 generic magic link template (UA only) |
| User schema | ✅ | email, provider, profile, credits, preferredLang, lastLoginAt |
| Unit тести | ✅ | 40+ cases (auth.service, users.service, app.controller) |
| E2E тести | ✅ | MongoMemoryServer + mocked Redis |

### Frontend (apps/web)

| Компонент | Статус | Деталі |
|-----------|--------|--------|
| Signin page | ✅ | Google button + Magic Link form (статично, без progressive disclosure) |
| Callback page | ✅ | OAuth redirect handler |
| Verify page | ✅ | Magic link verification (Suspense) |
| Auth store (Zustand) | ✅ | user, isAuthenticated, isLoading |
| AuthInitializer | ✅ | Silent refresh on load |
| AuthGuard | ✅ | Protected route wrapper |
| API client | ✅ | Axios + auto-refresh 401 + in-memory token |
| Route protection | ✅ | Middleware (cookie) + AuthGuard (store) |
| Header | ✅ | User info, logout, theme, lang |
| i18n | ✅ | uk/en для поточних сторінок |

### Shared (packages/types)

| Компонент | Статус | Деталі |
|-----------|--------|--------|
| SendMagicLinkSchema | ✅ | { email } |
| VerifyMagicLinkSchema | ✅ | { token } |
| AuthResponseSchema | ✅ | { user, accessToken } |
| UserSchema | ✅ | id, email, provider, profile, credits, preferredLang, createdAt, lastLoginAt |
| UserProfileSchema | ✅ | id, email, profile, credits, preferredLang |
| ERROR_CODE | ✅ | 6 кодів |
| emailSchema, objectIdSchema | ✅ | Reusable validation |

---

## Що потрібно реалізувати (❌)

### 1. packages/types — нові схеми та типи

| Що | Деталі |
|---|---|
| `passwordSchema` | `z.string().min(8)` — reusable |
| `MagicLinkPurpose` type | `'login' \| 'register' \| 'reset-password' \| 'delete-account'` |
| `MAGIC_LINK_PURPOSE` const | Enum object (as const) |
| `CheckEmailSchema` | `{ email: emailSchema }` |
| `CheckEmailResponseSchema` | `{ hasPassword: boolean, isNewUser: boolean }` |
| `LoginPasswordSchema` | `{ email: emailSchema, password: z.string() }` |
| `SetPasswordSchema` | `{ password: passwordSchema }` |
| `ChangePasswordSchema` | `{ currentPassword: z.string(), newPassword: passwordSchema }` |
| `VerifyPasswordSchema` | `{ password: z.string() }` |
| Оновити `AuthResponseSchema` | Додати optional `purpose: MagicLinkPurpose` |
| Оновити `UserSchema` | Додати `hasPassword: z.boolean()`, `deletedAt: z.date().nullable().optional()` |
| Оновити `UserProfileSchema` | Додати `hasPassword`, `deletedAt` |
| Новий error code | `ACCOUNT_DELETED` |

### 2. apps/api — User Schema зміни

| Поле | Тип | Default | Опис |
|---|---|---|---|
| `passwordHash` | `string \| null` | `null` | bcrypt hash, null = без пароля |
| `deletedAt` | `Date \| null` | `null` | Timestamp soft delete, null = активний |

### 3. apps/api — нові endpoints

| Endpoint | Method | Auth | Опис |
|---|---|---|---|
| `POST /auth/check-email` | — | — | Перевірка `{ hasPassword, isNewUser }` — progressive disclosure |
| `POST /auth/login/password` | — | — | Логін через email + password, brute force protection |
| `POST /auth/password/set` | JWT | JwtAuthGuard | Встановити пароль (user без пароля) |
| `POST /auth/password/change` | JWT | JwtAuthGuard | Змінити пароль (verify current + set new) |
| `POST /auth/password/delete` | JWT | JwtAuthGuard | Видалити пароль з акаунту |
| `POST /auth/password/verify` | JWT | JwtAuthGuard | Перевірка пароля (для deletion confirmation) |
| `POST /users/account/delete` | JWT | JwtAuthGuard | Ініціація soft delete |
| `POST /users/account/delete/confirm` | JWT | JwtAuthGuard | Підтвердження з password |
| `POST /users/account/restore` | JWT | JwtAuthGuard | Відновлення акаунту |
| `PATCH /users/me` | JWT | JwtAuthGuard | Оновлення профілю (name, avatar, preferredLang) |

### 4. apps/api — Magic Link purpose context

**Зараз:** Redis `magic:{token}` → `email` (string)
**Потрібно:** Redis `magic:{token}` → `JSON { email, purpose }`

Purpose визначає:
- Який email template надсилати
- Куди redirectити після verify
- Яку дію виконувати (для `delete-account` — soft delete)

### 5. apps/api — Password auth

| Компонент | Деталі |
|---|---|
| bcrypt інтеграція | hash + compare |
| Brute force protection | Progressive lockout: 5→1хв, 10→5хв, 20→15хв. Redis `login_attempts:{ip}:{email}` (IP+email ключ для захисту від DoS) |
| check-email rate limit | Redis `check_email:{ip}`, 10 req/min per-IP |
| Password validation | min 8 chars (configurable `AUTH_PASSWORD_MIN_LENGTH`) |
| Session invalidation | `revokeAllUserTokens()` при зміні/скиді пароля (крім поточної сесії) |
| Нові env vars | `AUTH_PASSWORD_MIN_LENGTH`, `AUTH_LOCKOUT_THRESHOLDS`, `AUTH_LOGIN_ATTEMPTS_TTL_MIN`, `AUTH_MAGIC_LINK_DEDUP_SEC`, `ACCOUNT_DELETION_GRACE_DAYS` |

### 6. apps/api — Email templates (5 замість 1)

| Purpose | Тема | CTA |
|---|---|---|
| `register` | Welcome to LucidShip | "Complete Registration" |
| `login` | Sign in to LucidShip | "Sign In" |
| `reset-password` | Reset Your Password | "Reset Password" |
| `delete-account` | Confirm Account Deletion | "Confirm Deletion" |
| (confirmation) | Account Scheduled for Deletion | "Sign in (to restore)" |

Кожен template — UA + EN (залежно від `user.preferredLang`).

### 7. apps/api — Account deletion flow

- Soft delete: set `deletedAt = now()`
- Revoke all refresh tokens
- Send confirmation email
- Grace period: 30 днів (configurable)
- Recovery: clear `deletedAt` при логіні
- Hard delete: cron job після grace period
- Під час grace period: email залишається "зайнятий"

### 8. apps/web — Progressive disclosure на signin

**Зараз:** Email → Magic Link (статично)
**Потрібно:**
1. Email + "Continue" + Google button
2. `POST /auth/check-email` → визначити scenario
3. **Scenario A** (hasPassword): password field + "Sign In" + "Forgot password?"
4. **Scenario B** (no password, existing): "Check your email" + magic link (purpose: login)
5. **Scenario C** (new user): "Check your email" + magic link (purpose: register)

### 9. apps/web — нові сторінки

| Сторінка | Route | Опис |
|---|---|---|
| Profile | `/(protected)/profile/page.tsx` | Перегляд/редагування, security, danger zone |
| (Recovery) | Частина signin flow | `deletedAt != null` → recovery screen |

### 10. apps/web — нові features/components

- Password form на signin (Scenario A)
- "Forgot password?" flow
- ProfileForm (first name, last name, avatar)
- SecuritySection (set/change/delete password)
- DangerZone (delete account)
- DeleteAccountModal (password або magic link confirmation)
- Account recovery screen

### 11. apps/web — нові API functions

| Функція | Endpoint |
|---|---|
| `checkEmail(email)` | `POST /auth/check-email` |
| `loginWithPassword(email, password)` | `POST /auth/login/password` |
| `setPassword(password)` | `POST /auth/password/set` |
| `changePassword(current, new)` | `POST /auth/password/change` |
| `deletePassword()` | `POST /auth/password/delete` |
| `verifyPassword(password)` | `POST /auth/password/verify` |
| `deleteAccount()` | `POST /users/account/delete` |
| `confirmDeleteAccount(password)` | `POST /users/account/delete/confirm` |
| `restoreAccount()` | `POST /users/account/restore` |
| `updateProfile(data)` | `PATCH /users/me` |
| Оновити `sendMagicLink(email, purpose?)` | Додати purpose parameter |

### 12. apps/web — i18n (масивне розширення)

Нові namespace'и:
- `auth_page.signin.continue_button`, `auth_page.signin.password_*`, `auth_page.signin.forgot_*`
- `auth_page.recovery.*`
- `profile_page.*` (heading, fields, security, danger zone)
- `delete_account_modal.*`
- `toast.*`

### 13. apps/web — routing зміни

- Middleware: додати `/profile` до protected paths
- Verify page: routing після verify залежно від purpose
- Signin page: recovery screen коли `deletedAt != null`

### 14. Redis keys — зміни та нові

**Оновлено:**

| Ключ | Було | Стане |
|---|---|---|
| `magic:{token}` | `email` (string) | `JSON { email, purpose }` |

**Нові:**

| Ключ | Значення | TTL | Призначення |
|---|---|---|---|
| `login_attempts:{ip}:{email}` | count (int) | 15 хв | Progressive lockout (IP+email) |
| `check_email:{ip}` | count (int) | 60s | Rate limit для check-email per-IP |
| `magic_dedup:{email}:{purpose}` | token (string) | 60s | Anti-spam дедуплікація magic link |
