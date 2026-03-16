# Sprint: Reset Password — Professional Flow

> Рефакторинг флоу скидання пароля з "magic link = автологін" на стандартний підхід: окрема сторінка для встановлення нового пароля, без авторизації, з confirm password та redirect на signin після успіху. Як у GitHub, Stripe, AWS.

---

## Проблема

Поточний флоу `reset-password` працює ідентично до `login` magic link:

1. Юзер натискає "Забули пароль?" → відправляється magic link з purpose `reset-password`
2. Юзер натискає посилання в листі → `/auth/verify?token=XXX`
3. **Verify page** викликає `POST /auth/magic-link/verify` → бекенд верифікує токен, створює JWT-сесію, повертає `accessToken` + `user`
4. Фронтенд зберігає токен, оновлює auth store → redirect на `/profile`
5. Юзер залогінений, але **ніякого скидання пароля не відбулось**

**Проблеми:**
- Юзер очікує форму "Введіть новий пароль", а отримує звичайний логін
- Токен reset дає повну авторизацію — security risk (має давати лише право змінити пароль)
- Немає підтвердження пароля (confirm password) — юзер вводить новий пароль вперше
- Попередні сесії не revoke-нуті після reset
- Старий пароль залишається активним

---

## Цільовий флоу

```
Signin page → "Забули пароль?" → magic link (purpose: reset-password)
    ↓
Email: "Скинути пароль" → посилання /auth/reset-password?token=XXX
    ↓
Окрема сторінка: New password + Confirm password → Submit
    ↓
POST /auth/password/reset { token, newPassword }
    ↓
Backend: verify token → hash password → save → revoke ALL sessions → НЕ видає JWT
    ↓
Redirect на /auth/signin + toast "Пароль змінено. Увійдіть із новим паролем."
```

**Ключові принципи:**
- Токен reset НЕ авторизує юзера — лише дає право змінити пароль
- Юзер НЕ залогінений після reset — має свідомо увійти з новим паролем
- Окрема standalone сторінка — мінімум UI, лише форма зміни пароля
- Confirm password — стандарт, юзер вводить новий пароль вперше
- Revoke all sessions — безпековий стандарт після password reset

---

## Аналіз поточного коду

### Що міняється

| Шар | Файл | Зміна |
|---|---|---|
| **Types** | `packages/types/src/contracts/auth.ts` | Новий `ResetPasswordSchema`, `ResetPasswordResponse` |
| **Types** | `packages/types/src/enums/response-code.ts` | Новий код `PASSWORD_RESET` |
| **Backend** | `apps/api/src/modules/auth/auth.service.ts` | Новий метод `resetPassword(token, newPassword)` |
| **Backend** | `apps/api/src/modules/auth/auth.controller.ts` | Новий endpoint `POST /auth/password/reset` |
| **Backend** | `apps/api/src/modules/auth/dto/` | Новий `reset-password.dto.ts` |
| **Backend** | `apps/api/src/modules/auth/services/email.service.ts` | Змінити URL посилання для reset-password purpose |
| **Frontend** | `apps/web/src/shared/api/auth.ts` | Нова функція `resetPassword(token, password)` |
| **Frontend** | `apps/web/src/app/[locale]/auth/reset-password/page.tsx` | **Нова сторінка** |
| **Frontend** | `apps/web/src/app/[locale]/auth/verify/page.tsx` | Видалити case `reset-password` |
| **Frontend** | `apps/web/src/middleware.ts` | `/auth/reset-password` — публічний роут |
| **Frontend** | `apps/web/messages/uk.json` | Нові i18n ключі `auth_page.reset_password` |
| **Frontend** | `apps/web/messages/en.json` | Нові i18n ключі `auth_page.reset_password` |
| **E2E тести** | `apps/api/test/auth.e2e-spec.ts` | Нові тести для `POST /auth/password/reset` |

### Що НЕ міняється

- `POST /auth/magic-link/send` — відправка magic link з purpose `reset-password` працює вірно
- Signin page `handleForgotPassword()` — відправляє magic link правильно, стан `magic-link-sent` показується коректно
- Email template тексти — залишаються (subject, body, CTA, footer), змінюється лише URL в посиланні
- Redis magic link storage/TTL/dedup/rate-limit — все працює
- `POST /auth/password/set` — існуючий endpoint для першого встановлення паролю (використовується в profile, не пов'язаний)
- `POST /auth/password/change` — існуючий endpoint для зміни пароля з поточним (теж не пов'язаний)
- SecuritySection в profile — `mode=reset-password` більше не потрібен, але видалення цього mode — breaking change для SecuritySection, тому видалити в кінці

---

## План імплементації

### Фаза 0: Types (packages/types)

**Крок 0.1 — Новий response code `PASSWORD_RESET`**

Файл: `packages/types/src/enums/response-code.ts`

Додати `PASSWORD_RESET: 'PASSWORD_RESET'` в секцію `auth success`. Додати маппінг `PASSWORD_RESET → SUCCESS` в `RESPONSE_CODE_TYPE`.

> Чому `PASSWORD_RESET` а не існуючий `PASSWORD_SET`: семантично це різні дії. `PASSWORD_SET` — перше встановлення пароля (юзер авторизований, не мав пароля). `PASSWORD_RESET` — скидання через email (юзер не авторизований, мав пароль).

**Крок 0.2 — Нова Zod-схема `ResetPasswordSchema`**

Файл: `packages/types/src/contracts/auth.ts`

```typescript
export const ResetPasswordSchema = z.object({
    token: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: passwordSchema,
}).refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
```

> Confirm password валідація на рівні Zod — `refine()` перевіряє що `newPassword === confirmPassword`. Бекенд отримує обидва поля і валідує через DTO. Фронтенд теж валідує через цю ж схему перед відправкою.

**Крок 0.3 — Збілдити types**

```bash
pnpm --filter @cyanship/types build
```

---

### Фаза 1: Backend

**Крок 1.1 — Новий DTO `reset-password.dto.ts`**

Файл: `apps/api/src/modules/auth/dto/reset-password.dto.ts`

```typescript
import { createZodDto } from 'nestjs-zod';
import { ResetPasswordSchema } from '@cyanship/types';

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
```

**Крок 1.2 — Новий метод `resetPassword()` в AuthService**

Файл: `apps/api/src/modules/auth/auth.service.ts`

```typescript
async resetPassword(token: string, newPassword: string): Promise<void> {
    // 1. Atomic GETDEL — одноразовий токен
    const magicKey = `magic:${token}`;
    const raw = await this.redis.getdel(magicKey);

    if (!raw) {
        throw new UnauthorizedException('Invalid or expired reset token');
    }

    // 2. Перевірити purpose
    const { email, purpose } = JSON.parse(raw) as {
        email: string;
        purpose: MagicLinkPurpose;
    };

    if (purpose !== MAGIC_LINK_PURPOSE.RESET_PASSWORD) {
        throw new BadRequestException('Invalid token purpose');
    }

    // 3. Знайти юзера
    const user = await this.usersService.findByEmail(email);
    if (!user) {
        throw new NotFoundException('User not found');
    }

    // 4. Hash та зберегти новий пароль
    const hash = await bcrypt.hash(newPassword, 10);
    await this.usersService.setPasswordHash(user._id.toString(), hash);

    // 5. Revoke ALL sessions — security best practice
    await this.revokeAllUserTokens(user._id.toString());
}
```

**Ключові рішення:**
- Метод **НЕ генерує JWT** — юзер не авторизується
- Метод **НЕ перевіряє чи є passwordHash** — reset працює і для зміни існуючого пароля, і для першого встановлення (edge case: OAuth-only юзер натиснув reset)
- Метод використовує `setPasswordHash()` напряму — це low-level метод UsersService який не перевіряє чи пароль вже існує (на відміну від `setPassword()` в AuthService, який кидає error якщо пароль є)
- `revokeAllUserTokens()` — після reset ВСІ пристрої розлогінені

**Крок 1.3 — Новий endpoint `POST /auth/password/reset`**

Файл: `apps/api/src/modules/auth/auth.controller.ts`

```typescript
@Post('password/reset')
async resetPassword(
    @Body() dto: ResetPasswordDto,
): Promise<ApiMessageResponse> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return {
        data: {
            code: RESPONSE_CODE.PASSWORD_RESET,
            message: 'Password has been reset',
        },
    };
}
```

**Важливо:** endpoint без guards — юзер НЕ авторизований. Захист через одноразовий magic link token.

**Крок 1.4 — Змінити URL в email template**

Файл: `apps/api/src/modules/auth/services/email.service.ts`

Поточний код (рядок 88):
```typescript
const link = `${ENV.WEB_URL}/auth/verify?token=${token}`;
```

Потрібно змінити URL лише для purpose `reset-password`. Додати параметр `purpose` у метод і змінити логіку формування URL:

```typescript
async sendMagicLink(
    email: string,
    token: string,
    purpose: MagicLinkPurpose = MAGIC_LINK_PURPOSE.LOGIN,
    lang: string = LANG.UK
): Promise<void> {
    const link = purpose === MAGIC_LINK_PURPOSE.RESET_PASSWORD
        ? `${ENV.WEB_URL}/auth/reset-password?token=${token}`
        : `${ENV.WEB_URL}/auth/verify?token=${token}`;
    // ... решта без змін
}
```

> Сигнатура методу не міняється — purpose вже передається. Просто додається умова на формування URL.

---

### Фаза 2: Frontend — API та i18n

**Крок 2.1 — Нова API функція `resetPassword()`**

Файл: `apps/web/src/shared/api/auth.ts`

```typescript
export async function resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string
): Promise<void> {
    await apiClient.post('/auth/password/reset', {
        token,
        newPassword,
        confirmPassword,
    });
}
```

Додати `resetPassword` в re-export з `apps/web/src/shared/api/index.ts`.

**Крок 2.2 — i18n ключі**

Новий namespace `auth_page.reset_password` в обох файлах.

Файл: `apps/web/messages/en.json` — додати в `auth_page`:

```json
"reset_password": {
    "heading": "Set new password",
    "description": "Enter your new password below.",
    "new_password_placeholder": "New password",
    "confirm_password_placeholder": "Confirm password",
    "submit_button": "Reset password",
    "success_toast": "Password changed. Sign in with your new password.",
    "passwords_mismatch": "Passwords do not match",
    "password_too_short": "Password must be at least 8 characters",
    "error_invalid_token": "This reset link is invalid or has expired. Please request a new one.",
    "error_generic": "Something went wrong. Please try again.",
    "back_to_signin": "Back to sign in"
}
```

Файл: `apps/web/messages/uk.json` — додати в `auth_page`:

```json
"reset_password": {
    "heading": "Встановіть новий пароль",
    "description": "Введіть новий пароль нижче.",
    "new_password_placeholder": "Новий пароль",
    "confirm_password_placeholder": "Підтвердіть пароль",
    "submit_button": "Скинути пароль",
    "success_toast": "Пароль змінено. Увійдіть із новим паролем.",
    "passwords_mismatch": "Паролі не збігаються",
    "password_too_short": "Пароль повинен містити мінімум 8 символів",
    "error_invalid_token": "Посилання для скидання недійсне або прострочене. Запросіть нове.",
    "error_generic": "Щось пішло не так. Спробуйте ще раз.",
    "back_to_signin": "Повернутись до входу"
}
```

Також додати ключ в `notifications.auth`:
```json
"password_reset": "Пароль успішно змінено"  // uk
"password_reset": "Password reset successfully"  // en
```

---

### Фаза 3: Frontend — Нова сторінка

**Крок 3.1 — Сторінка `/auth/reset-password`**

Файл: `apps/web/src/app/[locale]/auth/reset-password/page.tsx`

Standalone client component. Стани: `form | submitting | success | error`.

**Структура:**
```
<main> (flex, center, min-h-screen, px-4)
  <div> (max-w-md, space-y-8)

    STATE: form
      <h1> "Встановіть новий пароль"
      <p>  "Введіть новий пароль нижче."
      <form>
        <UiPasswordInput> "Новий пароль" (autoFocus)
        <UiPasswordInput> "Підтвердіть пароль"
        <UiButton variant="filled" size="lg"> "Скинути пароль"
      </form>

    STATE: submitting
      <form> з disabled полями + UiSpinner в кнопці

    STATE: success
      Redirect на /auth/signin (автоматичний)
      Toast: "Пароль змінено. Увійдіть із новим паролем."

    STATE: error
      <div> error card (border-destructive)
        <p> error message
      <UiButton as="link" href="/auth/signin"> "Повернутись до входу"
```

**Логіка:**
1. `useSearchParams()` → отримати `token` (обгорнути в `<Suspense>`)
2. Якщо `token` відсутній → одразу `error` стан з повідомленням `error_invalid_token`
3. Client-side валідація перед submit:
   - `passwordSchema.safeParse(newPassword)` — мін. 8 символів
   - `newPassword === confirmPassword` — співпадіння
4. Submit → `resetPassword(token, newPassword, confirmPassword)`
5. Success → `toast.success(t('success_toast'))` → `router.replace('/${locale}/auth/signin')`
6. Error → parse response code:
   - `UNAUTHORIZED` або `INVALID_MAGIC_LINK` → показати `error_invalid_token`
   - Інше → показати `error_generic`

**Важливо:**
- Сторінка НЕ потребує авторизації (публічний роут)
- НЕ викликає `setAccessToken()` чи `useAuthStore`
- НЕ встановлює cookies
- Це чистий `'use client'` component з формою

**Крок 3.2 — Middleware: додати `/auth/reset-password` як публічний роут**

Файл: `apps/web/src/middleware.ts`

Роут `/auth/reset-password` не входить в `PROTECTED_PATHS` і не входить в `AUTH_PATHS`, тому middleware його не блокує. **Змін не потрібно.**

Однак потрібно перевірити edge case: якщо юзер вже залогінений (має `bid_refresh` cookie) і відкриває `/auth/reset-password` — це має працювати нормально. Middleware не редіректить цей роут, тому проблем немає.

**Крок 3.3 — Видалити case `reset-password` з verify page**

Файл: `apps/web/src/app/[locale]/auth/verify/page.tsx`

Видалити блок:
```typescript
case 'reset-password': {
    const user = await getMe();
    useAuthStore.getState().setUser(user);
    setStatus('success');
    router.replace(`/${locale}/profile`);
    break;
}
```

Тепер якщо purpose `reset-password` потрапить на verify page (старий email, закешований URL) — він впаде в `default` case і залогінить юзера. Це acceptable fallback, бо:
- Старі magic link токени мають TTL 15 хв — через годину жодного старого токена не буде
- Email template вже вказуватиме на новий URL `/auth/reset-password`
- Purpose `reset-password` більше не повинен потрапляти на `/auth/verify`

Альтернатива (строгіша): в `default` case додати перевірку `if (result.purpose === 'reset-password')` → показати error "Використайте посилання з нового листа". Але це оверінжинірінг для 15-хвилинного вікна.

---

### Фаза 4: Cleanup

**Крок 4.1 — Видалити `mode=reset-password` з SecuritySection**

Файл: `apps/web/src/features/profile/SecuritySection.tsx`

Видалити `isResetMode` логіку (рядки 49, 53, 63, 107, 115, 194-271 частково). `mode=reset-password` більше не використовується — жоден роут не редіректить на `/profile?mode=reset-password`.

Конкретно:
- Видалити `const isResetMode = hasPassword && mode === 'reset-password';`
- В `isPasswordRequired`: видалити `mode === 'reset-password'`
- В `getHeading()`: видалити `if (isResetMode)` branch
- В `handleChangePassword()`: видалити `if (isResetMode)` branch (завжди використовувати `changePassword()`)
- В JSX: видалити `|| isResetMode` з умови рендерингу

**Крок 4.2 — Видалити `'reset-password'` з `ProfileMode` type**

Файл: `apps/web/src/features/profile/SecuritySection.tsx` (рядок 20)

```typescript
// Було:
export type ProfileMode = 'new' | 'set-password' | 'reset-password' | null;

// Стало:
export type ProfileMode = 'new' | 'set-password' | null;
```

Перевірити що ніде в коді не залишилось посилань на `mode=reset-password`.

---

### Фаза 5: E2E тести

**Крок 5.1 — Тести для `POST /auth/password/reset`**

Файл: `apps/api/test/auth.e2e-spec.ts`

Додати тест-кейси:

```
describe('POST /auth/password/reset', () => {

    it('should reset password with valid token')
    - Створити юзера з passwordHash
    - Надіслати magic link (purpose: reset-password) → дістати token з Redis mock
    - POST /auth/password/reset { token, newPassword, confirmPassword }
    - Expect 200, code: PASSWORD_RESET
    - Перевірити: старий пароль не працює (POST /auth/login/password → 401)
    - Перевірити: новий пароль працює (POST /auth/login/password → 200)
    - Перевірити: response НЕ містить accessToken

    it('should reject invalid token')
    - POST /auth/password/reset { token: 'invalid', newPassword, confirmPassword }
    - Expect 401

    it('should reject expired/used token')
    - Створити token → використати → спробувати ще раз
    - Expect 401 (GETDEL вже видалив)

    it('should reject token with wrong purpose')
    - Створити magic link з purpose: login
    - POST /auth/password/reset з цим token
    - Expect 400

    it('should reject mismatched passwords')
    - POST /auth/password/reset { token, newPassword: 'aaaaaaaa', confirmPassword: 'bbbbbbbb' }
    - Expect 400 (Zod validation)

    it('should reject short password')
    - POST /auth/password/reset { token, newPassword: '123', confirmPassword: '123' }
    - Expect 400 (Zod validation)

    it('should revoke all existing sessions after reset')
    - Створити юзера, залогінити, отримати refresh token
    - Reset password
    - POST /auth/refresh з старим refresh token → 401

    it('should work for OAuth-only user without existing password')
    - Створити юзера без passwordHash (OAuth)
    - Reset password → пароль встановлено
    - Login з новим паролем → 200
});
```

**Крок 5.2 — Оновити існуючі тести**

Перевірити що видалення case `reset-password` з verify page не зламало існуючих frontend тестів. Якщо є тест для verify page з purpose `reset-password` — видалити або оновити.

---

## Файли — повний список змін

```
packages/types/src/
├── enums/response-code.ts           # +PASSWORD_RESET code + type mapping
└── contracts/auth.ts                # +ResetPasswordSchema, +ResetPasswordDto

apps/api/src/modules/auth/
├── auth.service.ts                  # +resetPassword() method
├── auth.controller.ts               # +POST /auth/password/reset endpoint
├── dto/reset-password.dto.ts        # NEW: createZodDto(ResetPasswordSchema)
└── services/email.service.ts        # URL: /auth/verify → /auth/reset-password for reset purpose

apps/web/src/
├── shared/api/auth.ts               # +resetPassword() function
├── shared/api/index.ts              # +re-export resetPassword
├── app/[locale]/auth/
│   ├── reset-password/page.tsx      # NEW: standalone reset password page
│   └── verify/page.tsx              # -case 'reset-password'
├── features/profile/
│   └── SecuritySection.tsx          # -isResetMode, -mode='reset-password'

apps/web/messages/
├── uk.json                          # +auth_page.reset_password, +notifications.auth.password_reset
└── en.json                          # +auth_page.reset_password, +notifications.auth.password_reset

apps/api/test/
└── auth.e2e-spec.ts                 # +POST /auth/password/reset tests
```

---

## API зміни

### Новий endpoint

| Method | Path | Guard | Request | Response |
|---|---|---|---|---|
| POST | `/api/auth/password/reset` | **Немає** (публічний) | `{ token: string, newPassword: string, confirmPassword: string }` | `{ data: { code: 'PASSWORD_RESET', message: 'Password has been reset' } }` |

### Існуючі endpoints — без змін

`POST /auth/magic-link/send`, `POST /auth/password/set`, `POST /auth/password/change` — залишаються як є.

---

## i18n mapping

| Response code | Success/Error | uk key | en key |
|---|---|---|---|
| `PASSWORD_RESET` | success | `notifications.auth.password_reset` | `notifications.auth.password_reset` |

Додати в `apps/web/src/shared/api/mapApiCode.ts` якщо потрібно (перевірити чи автоматичний маппінг покриває).

---

## Чеклист конвенцій

- [ ] Zod = single source of truth — схема в `packages/types`, DTO через `createZodDto()`
- [ ] Fail-fast — новий endpoint не потребує env vars
- [ ] API response format — `{ data: { code, message } }` для success
- [ ] Tone: classic-polite, формальне "ви", без емодзі — в i18n ключах
- [ ] UI primitives — `UiPasswordInput`, `UiButton`, `UiSpinner` — без raw HTML elements
- [ ] Design tokens — кольори через token classes (`text-foreground`, `border-destructive`)
- [ ] i18n — всі тексти через `useTranslations()`, ніякого hardcoded тексту
- [ ] Server/client — сторінка `'use client'` (форма з state), обгорнута в `<Suspense>` (useSearchParams)
- [ ] Password hashing — bcrypt, salt rounds 10
- [ ] Security — one-time token (GETDEL), purpose validation, revoke all sessions

---

## Залежності та ризики

| Ризик | Мітігація |
|---|---|
| Старі email з URL `/auth/verify?token=XXX` (15 хв вікно) | Token TTL 15 хв. Verify page default case залогінить юзера — не ідеально, але безпечно. Через 15 хв проблема зникає |
| `setPasswordHash()` — low-level, не перевіряє existing password | Це правильна поведінка для reset. Юзер підтвердив identity через magic link. Перевірка existing password не потрібна |
| OAuth-only юзер робить reset | Edge case: юзер без пароля отримує пароль через reset. Коректна поведінка — `setPasswordHash()` працює і без existing hash |
| `confirmPassword` на бекенді — надлишково? | Zod refine в DTO валідує на бекенді. Defense in depth — клієнт може мати баг, бекенд ловить |
| Frontend тести SecuritySection | Після видалення `isResetMode` — перевірити що тести SecuritySection не тестують `mode=reset-password` |

---

## Порядок виконання

```
0.1 PASSWORD_RESET response code
    ↓
0.2 ResetPasswordSchema (Zod)
    ↓
0.3 Build types
    ↓
1.1 reset-password.dto.ts
    ↓
1.2 AuthService.resetPassword()
    ↓
1.3 POST /auth/password/reset endpoint
    ↓
1.4 Email URL: /auth/verify → /auth/reset-password (for reset purpose)
    ↓
2.1 Frontend: resetPassword() API function
    ↓
2.2 i18n keys (uk.json + en.json)
    ↓
3.1 /auth/reset-password page (NEW) ← блокується 2.1 та 2.2
    ↓
3.3 Verify page: видалити case 'reset-password'
    ↓
4.1 SecuritySection: видалити isResetMode
    ↓
4.2 ProfileMode: видалити 'reset-password'
    ↓
5.1 E2E тести для POST /auth/password/reset
    ↓
5.2 Перевірити існуючі тести
```

**Фази 0-1 — блокуючі.** Backend endpoint має бути готовий до того як фронтенд зможе його викликати. Фаза 2 (API function + i18n) блокує фазу 3 (сторінка). Фаза 4 (cleanup) може бути паралельно з фазою 5 (тести).
