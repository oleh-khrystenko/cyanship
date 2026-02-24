# Фаза 8: Тести + QA

> Залежить від: всі попередні фази

## 8.1 Unit тести (API)

### `apps/api/src/modules/auth/auth.service.spec.ts`

Розширити існуючий файл тестів:

#### checkEmail

| # | Кейс | Input | Expected |
|---|---|---|---|
| 1 | Existing user з password | email з passwordHash | `{ hasPassword: true, isNewUser: false }` |
| 2 | Existing user без password | email без passwordHash | `{ hasPassword: false, isNewUser: false }` |
| 3 | New user | неіснуючий email | `{ hasPassword: false, isNewUser: true }` |
| 4 | Email normalization | `" User@Email.COM "` | trim + lowercase перед пошуком |

#### loginWithPassword

| # | Кейс | Input | Expected |
|---|---|---|---|
| 1 | Happy path | valid email + password | tokens + user object |
| 2 | Invalid password | valid email + wrong password | 401, increment attempts |
| 3 | User not found | nonexistent email | 401, increment attempts |
| 4 | User without password | email (no passwordHash) | 401, increment attempts |
| 5 | Brute force block | >= MAX_LOGIN_ATTEMPTS | 429 TooManyRequests |
| 6 | Success clears attempts | login after failed attempts | login_attempts key deleted |
| 7 | lastLoginAt updated | successful login | user.lastLoginAt = new Date() |
| 8 | Deleted account | user з deletedAt | `{ accountDeleted: true, deletedAt }` |

#### Progressive lockout (brute force protection)

| # | Кейс | Expected |
|---|---|---|
| 1 | First failed attempt | Redis INCR `login_attempts:{ip}:{email}` |
| 2 | 4 attempts (< threshold) | Ще дозволено |
| 3 | 5 attempts | 429 TooManyRequests (1 хв block) |
| 4 | 10 attempts | 429 TooManyRequests (5 хв block) |
| 5 | 20 attempts | 429 TooManyRequests (15 хв block) |
| 6 | TTL на Redis key | = AUTH_LOGIN_ATTEMPTS_TTL_MIN * 60 |
| 7 | After successful login | Redis DEL `login_attempts:{ip}:{email}` |
| 8 | Different IP, same email | Не блокує (окремий ключ) |
| 9 | Same IP, different email | Не блокує (окремий ключ) |

#### check-email rate limit

| # | Кейс | Expected |
|---|---|---|
| 1 | 10 requests from same IP | Всі дозволені |
| 2 | 11th request from same IP | 429 TooManyRequests |
| 3 | Request from different IP | Дозволено (окремий лічильник) |
| 4 | TTL на Redis key | 60s |

#### Magic link з purpose

| # | Кейс | Expected |
|---|---|---|
| 1 | sendMagicLink default | purpose = 'login' в Redis JSON |
| 2 | sendMagicLink explicit purpose | purpose збережено в Redis |
| 3 | verifyMagicLink login | return `{ user, accessToken, purpose: 'login' }` |
| 4 | verifyMagicLink register | return `{ user, accessToken, purpose: 'register' }` |
| 5 | verifyMagicLink reset-password | return `{ user, accessToken, purpose: 'reset-password' }` |
| 6 | verifyMagicLink delete-account | виконує soft delete, revoke tokens |
| 7 | Rate limiting per-email | НЕ per-purpose — один ліміт на email |
| 8 | Email service отримує purpose + lang | correct arguments passed |
| 9 | Anti-spam dedup: повторний виклик < 60s | Success без відправки email |
| 10 | Anti-spam dedup: повторний виклик > 60s | Відправляє новий email |
| 11 | Dedup per email+purpose | Різні purposes — обидва відправляються |

#### Password management

| # | Кейс | Expected |
|---|---|---|
| 1 | setPassword — no existing | bcrypt hash → save |
| 2 | setPassword — already has password | 400 BadRequest |
| 3 | setPassword — user not found | 404 NotFound |
| 4 | changePassword — valid current | new hash saved + revokeAllUserTokens called + new tokens returned |
| 5 | changePassword — invalid current | 401 Unauthorized |
| 6 | changePassword — no password set | 400 BadRequest |
| 7 | deletePassword — has password | passwordHash = null |
| 8 | deletePassword — no password | 400 BadRequest |
| 9 | verifyPassword — valid | true |
| 10 | verifyPassword — invalid | false |
| 11 | verifyPassword — no password | false |
| 12 | verifyPassword — user not found | false |

#### handleDeleteAccountVerification

| # | Кейс | Expected |
|---|---|---|
| 1 | Valid email | soft delete + revoke tokens + send email |
| 2 | User not found | 404 NotFound |

---

### `apps/api/src/modules/users/users.service.spec.ts`

Розширити існуючий файл тестів:

#### Password hash methods

| # | Кейс | Expected |
|---|---|---|
| 1 | setPasswordHash | passwordHash field updated |
| 2 | clearPasswordHash | passwordHash = null |

#### Account methods

| # | Кейс | Expected |
|---|---|---|
| 1 | softDelete | deletedAt = new Date() |
| 2 | restore | deletedAt = null |
| 3 | updateProfile — name | profile.name updated |
| 4 | updateProfile — avatar | profile.avatar updated |
| 5 | updateProfile — preferredLang | preferredLang updated |
| 6 | updateProfile — partial | тільки надані поля оновлюються |

---

### `apps/api/src/modules/auth/services/email.service.spec.ts` (new або extend)

| # | Кейс | Expected |
|---|---|---|
| 1 | sendMagicLink — purpose=register, lang=uk | correct subject + html |
| 2 | sendMagicLink — purpose=login, lang=en | correct subject + html |
| 3 | sendMagicLink — purpose=reset-password | correct template |
| 4 | sendMagicLink — purpose=delete-account | correct template + warning |
| 5 | sendDeletionConfirmation — uk | correct subject + deletion date + recovery info |
| 6 | sendDeletionConfirmation — en | correct subject + deletion date + recovery info |
| 7 | Link includes token | verify link format |

---

## 8.2 E2E тести (API)

### `apps/api/test/app.e2e-spec.ts`

Розширити E2E тести. Всі тести використовують `supertest` + in-memory MongoDB (або test DB).

#### POST /auth/check-email

```typescript
describe('POST /auth/check-email', () => {
    it('new user → { hasPassword: false, isNewUser: true }');
    it('existing user with password → { hasPassword: true, isNewUser: false }');
    it('existing user without password → { hasPassword: false, isNewUser: false }');
    it('validates email format → 400');
});
```

#### POST /auth/login/password

```typescript
describe('POST /auth/login/password', () => {
    it('valid credentials → 200 + user + accessToken + cookie');
    it('invalid password → 401');
    it('nonexistent email → 401');
    it('user without password → 401');
    it('progressive lockout → 429 after 5 attempts (1 min block)');
    it('progressive lockout → 429 after 10 attempts (5 min block)');
    it('progressive lockout → 429 after 20 attempts (15 min block)');
    it('different IP same email → not blocked');
    it('successful login after failed attempts → clears counter');
    it('deleted account → 200 + accountDeleted: true');
});
```

#### POST /auth/magic-link/send (з purpose)

```typescript
describe('POST /auth/magic-link/send', () => {
    it('default purpose = login');
    it('explicit purpose = register');
    it('explicit purpose = reset-password');
    it('explicit purpose = delete-account');
    it('rate limiting → 429 after 3 requests');
    it('anti-spam dedup → second call within 60s does not send email');
});
```

#### POST /auth/magic-link/verify (з purpose)

```typescript
describe('POST /auth/magic-link/verify', () => {
    it('purpose login → user + accessToken + purpose');
    it('purpose register → user + accessToken + purpose');
    it('purpose reset-password → user + accessToken + purpose');
    it('purpose delete-account → soft delete + revoke');
    it('invalid token → 401');
    it('expired token → 401');
});
```

#### POST /auth/password/*

```typescript
describe('POST /auth/password/set', () => {
    it('set password (no existing) → 200');
    it('set password (already exists) → 400');
    it('no auth → 401');
});

describe('POST /auth/password/change', () => {
    it('valid current + new → 200 + new accessToken + refreshToken cookie');
    it('invalid current → 401');
    it('no password set → 400');
    it('session invalidation → all other refresh tokens revoked');
    it('no auth → 401');
});

describe('POST /auth/password/delete', () => {
    it('has password → 200');
    it('no password → 400');
    it('no auth → 401');
});

describe('POST /auth/password/verify', () => {
    it('valid password → { isValid: true }');
    it('invalid password → { isValid: false }');
    it('no auth → 401');
});
```

#### Account management

```typescript
describe('POST /users/account/delete', () => {
    it('user with password → { requiresPassword: true }');
    it('user without password → { requiresMagicLink: true }');
    it('no auth → 401');
});

describe('POST /users/account/delete/confirm', () => {
    it('valid password → soft delete + revoke + email');
    it('invalid password → 401');
    it('no auth → 401');
});

describe('POST /users/account/restore', () => {
    it('deleted account → restore → 200');
    it('non-deleted account → 400');
    it('no auth → 401');
});
```

#### PATCH /users/me

```typescript
describe('PATCH /users/me', () => {
    it('update name → 200 + updated profile');
    it('update avatar → 200');
    it('update preferredLang → 200');
    it('partial update → only provided fields change');
    it('no auth → 401');
});
```

---

## 8.3 Manual E2E testing

Чеклист для ручного тестування всіх flows:

### Signin — Progressive Disclosure

- [ ] **Scenario A**: Ввести email існуючого user з паролем → побачити password field → ввести пароль → успішний вхід → redirect до /check
- [ ] **Scenario B**: Ввести email нового user → побачити "Перевірте пошту" → отримати email з purpose=register → клік → verify → redirect до /profile?mode=new
- [ ] **Scenario C**: Ввести email існуючого user без пароля → побачити "Перевірте пошту" → отримати email з purpose=login → клік → verify → redirect до /profile?mode=set-password
- [ ] **Google OAuth**: Клік "Увійти через Google" → consent → callback → redirect до /check
- [ ] **"Інший email"**: На password screen натиснути "Інший email" → повертає до email input

### Password Auth

- [ ] **Успішний вхід з паролем**: email + password → 200 → redirect
- [ ] **Show/hide toggle**: Іконка ока перемикає видимість пароля
- [ ] **"Змінити email"**: На password screen натиснути "Змінити" → повертає до кроку email
- [ ] **Невірний пароль**: email + wrong password → error message
- [ ] **Progressive lockout (5)**: 5 невірних спроб → "Спробуйте через 1 хвилину"
- [ ] **Progressive lockout (10)**: 10 невірних спроб → "Спробуйте через 5 хвилин"
- [ ] **Progressive lockout (20)**: 20 невірних спроб → "Спробуйте через 15 хвилин"
- [ ] **Lockout per IP+email**: З іншого IP той самий email — не заблокований
- [ ] **check-email rate limit**: 11 запитів per-IP → 429
- [ ] **Forgot password**: На password screen натиснути "Забули пароль?" → toast "Якщо акаунт існує..." → email з purpose=reset-password → verify → /profile?mode=reset-password → ввести новий пароль
- [ ] **Forgot password (неіснуючий email)**: Той самий toast що й при існуючому email
- [ ] **Anti-spam magic link**: Двічі швидко натиснути "Продовжити" → другий запит не відправляє email

### Profile

- [ ] **Новий user (mode=new)**: Заповнити ім'я (required) → зберегти → redirect до /check
- [ ] **Set password (mode=set-password)**: Встановити пароль (optional) → зберегти
- [ ] **Reset password (mode=reset-password)**: Ввести новий пароль (required) → зберегти
- [ ] **Default mode**: Переглянути профіль → редагувати ім'я → зберегти → toast "Профіль оновлено"
- [ ] **Change password**: Security → "Змінити пароль" → ввести поточний + новий (show/hide toggle) → зберегти → toast "Пароль змінено. Інші пристрої відключено"
- [ ] **Session invalidation**: Після зміни пароля — на іншому пристрої "вилітає" при наступному refresh
- [ ] **Delete password**: Security → "Видалити пароль" → confirm → toast "Пароль видалено"
- [ ] **Language switch**: Змінити мову → зберегти → UI перемикається

### Account Deletion

- [ ] **З паролем**: Danger Zone → "Видалити акаунт" → modal з password → ввести пароль → підтвердити → отримати email → redirect на signin
- [ ] **Без пароля**: Danger Zone → "Видалити акаунт" → toast "Посилання надіслано" → отримати email → клік → акаунт видалено → redirect на signin
- [ ] **Невірний пароль у modal**: Ввести невірний пароль → error "Невірний пароль"

### Account Recovery

- [ ] **Login після deletion**: Ввести email → password → `accountDeleted: true` → recovery screen → "Відновити акаунт" → toast "Акаунт відновлено" → normal app
- [ ] **Magic link після deletion**: Ввести email → magic link → verify → `accountDeleted: true` → recovery screen → restore

### Email Templates

- [ ] **Register email**: Subject "Ласкаво просимо до LucidKit" (uk) / "Welcome to LucidKit" (en)
- [ ] **Login email**: Subject "Вхід до LucidKit" (uk) / "Sign in to LucidKit" (en)
- [ ] **Reset password email**: Subject "Скидання пароля" (uk) / "Reset Your Password" (en)
- [ ] **Delete account email**: Subject "Підтвердження видалення акаунту" (uk) / "Confirm Account Deletion" (en)
- [ ] **Deletion confirmation email**: Містить дату остаточного видалення + інструкцію відновлення

### Cross-cutting

- [ ] **401 auto-refresh**: Access token expired → auto refresh → retry request → success
- [ ] **Cookie**: `bid_refresh` правильно встановлюється на всіх auth flows
- [ ] **Middleware**: /profile без auth → redirect на /auth/signin
- [ ] **i18n**: Всі нові ключі працюють в UK та EN

---

## Verification

1. `pnpm --filter @lucidkit/types build` — types компілюються без помилок
2. `pnpm --filter api test` — всі unit тести pass
3. `pnpm --filter api test:e2e` — всі E2E тести pass
4. `pnpm build` — повний build без помилок
5. Manual: пройти весь чеклист з секції 8.3
