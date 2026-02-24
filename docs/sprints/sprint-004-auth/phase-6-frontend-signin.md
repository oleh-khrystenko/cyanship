# Фаза 6: Frontend — Progressive Disclosure (Signin)

> Залежить від: Фаза 2 + Фаза 3

## 6.1 Signin page рефакторинг

### `apps/web/src/app/[locale]/auth/signin/page.tsx`

**Поточний flow:** email → magic link (статично, один крок)

**Новий flow (state machine):**

```
┌──────────┐    checkEmail()    ┌────────────┐
│  email   │ ────────────────→  │  loading    │
│  input   │                    └──────┬─────┘
└──────────┘                           │
                          ┌────────────┼────────────┐
                          ↓            ↓            ↓
                    ┌──────────┐ ┌──────────┐ ┌──────────┐
                    │ password │ │magic-link│ │ recovery │
                    │(Scen. A) │ │(Scen.B/C)│ │(deleted) │
                    └──────────┘ └──────────┘ └──────────┘
```

### States

1. **`email`** — email field + "Продовжити" button + Google OAuth button
2. **`loading`** — spinner під час `checkEmail()` API call
3. **`password`** (Scenario A: hasPassword=true) — email (readonly з ✓) + password field + "Увійти" + "Забули пароль?"
4. **`magic-link-sent`** (Scenario B/C) — "Перевірте пошту" повідомлення, можливість змінити email
5. **`recovery`** — екран відновлення акаунту (якщо `accountDeleted: true` у response)
6. **`error`** — помилка (brute force block, server error)

### Логіка переходів

```typescript
// State: email → submit
const handleEmailSubmit = async (email: string) => {
    setState('loading');
    const { hasPassword, isNewUser } = await checkEmail(email);

    if (hasPassword) {
        setState('password'); // Scenario A
    } else {
        // Scenario B (new user) або C (existing without password)
        const purpose = isNewUser ? 'register' : 'login';
        await sendMagicLink(email, purpose);
        setState('magic-link-sent');
    }
};

// State: password → submit
const handlePasswordSubmit = async (email: string, password: string) => {
    const result = await loginWithPassword(email, password);

    if (result.accountDeleted) {
        setState('recovery'); // Deleted account
    } else {
        // Normal login — redirect
        router.push('/check');
    }
};

// State: password → forgot password
const handleForgotPassword = async (email: string) => {
    await sendMagicLink(email, 'reset-password');
    // Однакове повідомлення незалежно від існування email (anti-enumeration)
    toast.success(t('forgot_password_sent'));
    setState('magic-link-sent');
};
```

### UI для кожного state

**State: email**
```
┌─────────────────────────────┐
│        Вхід до LucidKit     │
│                             │
│  ┌───────────────────────┐  │
│  │ Email                 │  │
│  └───────────────────────┘  │
│                             │
│  [ Продовжити             ] │
│                             │
│  ─────── або ──────────     │
│                             │
│  [ G  Увійти через Google ] │
└─────────────────────────────┘
```

**State: password (Scenario A)**
```
┌─────────────────────────────┐
│        Вхід до LucidKit     │
│                             │
│  ┌───────────────────────┐  │
│  │ user@email.com [Змін] │  │ ← readonly, з кнопкою "Змінити"
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Пароль            [👁] │  │ ← show/hide toggle
│  └───────────────────────┘  │
│              Забули пароль? │ ← link
│                             │
│  [ Увійти                 ] │
└─────────────────────────────┘
```

- **Show/hide toggle:** Іконка ока (lucide-react `Eye`/`EyeOff`) перемикає `type="password"` ↔ `type="text"`. Замість окремого поля "Підтвердити пароль" — менше фрустрації.
- **"Змінити":** Повертає до state `email` — юзер не змушений натискати Back у браузері. Кнопка всередині поля email (як suffix).

**State: magic-link-sent (Scenario B/C)**
```
┌─────────────────────────────┐
│      Перевірте пошту        │
│                             │
│  📧 Ми надіслали посилання  │
│  на user@email.com          │
│                             │
│  Перевірте папку "Вхідні"   │
│  та натисніть на посилання  │
│  для входу.                 │
│                             │
│  ← Інший email              │
└─────────────────────────────┘
```

**State: recovery**
```
┌─────────────────────────────┐
│     Акаунт деактивовано     │
│                             │
│  Ваш акаунт було видалено   │
│  {date}. Він буде остаточно │
│  видалено через {days} днів.│
│                             │
│  [ Відновити акаунт       ] │
│  [ Вийти                  ] │
└─────────────────────────────┘
```

---

## 6.2 Нові API functions

### `apps/web/src/shared/api/auth.ts`

Додати нові функції:

```typescript
// Check email — progressive disclosure
export async function checkEmail(email: string) {
    const { data } = await client.post<ApiResponse<CheckEmailResponse>>(
        '/auth/check-email',
        { email },
    );
    return data.data;
}

// Login з паролем
export async function loginWithPassword(email: string, password: string) {
    const { data } = await client.post<ApiResponse<AuthResponse>>(
        '/auth/login/password',
        { email, password },
    );
    return data.data;
}

// Password management
export async function setPassword(password: string) {
    const { data } = await client.post('/auth/password/set', { password });
    return data.data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
    const { data } = await client.post('/auth/password/change', {
        currentPassword,
        newPassword,
    });
    return data.data;
}

export async function deletePassword() {
    const { data } = await client.post('/auth/password/delete');
    return data.data;
}

export async function verifyPassword(password: string) {
    const { data } = await client.post<ApiResponse<{ isValid: boolean }>>(
        '/auth/password/verify',
        { password },
    );
    return data.data;
}

// Account management
export async function deleteAccount() {
    const { data } = await client.post('/users/account/delete');
    return data.data;
}

export async function confirmDeleteAccount(password: string) {
    const { data } = await client.post('/users/account/delete/confirm', {
        password,
    });
    return data.data;
}

export async function restoreAccount() {
    const { data } = await client.post('/users/account/restore');
    return data.data;
}
```

Оновити існуючу функцію:

```typescript
// Додати optional purpose
export async function sendMagicLink(email: string, purpose?: MagicLinkPurpose) {
    const { data } = await client.post('/auth/magic-link/send', {
        email,
        purpose,
    });
    return data.data;
}
```

---

## 6.3 Verify page — purpose routing

### `apps/web/src/app/[locale]/auth/verify/page.tsx`

Після успішної верифікації magic link — routing залежно від `purpose`:

```typescript
const result = await verifyMagicLink(token);

switch (result.purpose) {
    case 'register':
        // Новий user — redirect на профіль для заповнення
        router.push('/profile?mode=new');
        break;

    case 'login':
        // Існуючий user без пароля — пропонуємо встановити
        router.push('/profile?mode=set-password');
        break;

    case 'reset-password':
        // Reset password — redirect на профіль з обов'язковим паролем
        router.push('/profile?mode=reset-password');
        break;

    case 'delete-account':
        // Акаунт видалено — показати повідомлення → redirect на signin
        toast.success(t('account_deleted'));
        router.push('/auth/signin');
        break;

    default:
        // Fallback — redirect до app
        router.push('/check');
}
```

---

## 6.4 Auth store розширення

### `apps/web/src/stores/auth/authStore.ts`

Оновити тип `UserProfile` — додати нові поля (вони вже є в `@lucidkit/types`):

```typescript
interface UserProfile {
    id: string;
    email: string;
    profile: { name?: string; avatar?: string };
    credits: { balance: number; freeReportUsed: boolean };
    preferredLang: string;
    hasPassword: boolean;      // ← нове
    deletedAt: string | null;  // ← нове
}
```

---

## 6.5 i18n — signin розширення

### `apps/web/messages/uk.json`

```json
{
    "auth_page": {
        "signin": {
            "title": "Вхід до LucidKit",
            "email_label": "Email",
            "email_placeholder": "your@email.com",
            "continue_button": "Продовжити",
            "or_divider": "або",
            "google_button": "Увійти через Google",
            "password_label": "Пароль",
            "password_placeholder": "Введіть пароль",
            "signin_button": "Увійти",
            "forgot_password": "Забули пароль?",
            "forgot_password_sent": "Якщо акаунт з цією адресою існує, ми надіслали посилання для зміни пароля",
            "change_email": "Змінити",
            "other_email": "Інший email",
            "magic_link_sent_title": "Перевірте пошту",
            "magic_link_sent_description": "Ми надіслали посилання на {email}. Перевірте папку \"Вхідні\" та натисніть на посилання для входу.",
            "invalid_credentials": "Невірний email або пароль",
            "too_many_attempts": "Забагато спроб. Спробуйте через {minutes} хвилин або скористайтесь посиланням «Забули пароль?»",
            "session_revoked": "Сесію завершено. Увійдіть знову",
            "error_generic": "Щось пішло не так. Спробуйте ще раз"
        },
        "recovery": {
            "title": "Акаунт деактивовано",
            "description": "Ваш акаунт було видалено {date}. Він буде остаточно видалено через {days} днів.",
            "restore_button": "Відновити акаунт",
            "logout_button": "Вийти",
            "restored": "Акаунт відновлено!"
        }
    }
}
```

### `apps/web/messages/en.json`

```json
{
    "auth_page": {
        "signin": {
            "title": "Sign in to LucidKit",
            "email_label": "Email",
            "email_placeholder": "your@email.com",
            "continue_button": "Continue",
            "or_divider": "or",
            "google_button": "Sign in with Google",
            "password_label": "Password",
            "password_placeholder": "Enter password",
            "signin_button": "Sign In",
            "forgot_password": "Forgot password?",
            "forgot_password_sent": "If an account with this email exists, we sent a password reset link",
            "change_email": "Change",
            "other_email": "Different email",
            "magic_link_sent_title": "Check your email",
            "magic_link_sent_description": "We sent a link to {email}. Check your inbox and click the link to sign in.",
            "invalid_credentials": "Invalid email or password",
            "too_many_attempts": "Too many attempts. Try again in {minutes} minutes or use \"Forgot password?\"",
            "session_revoked": "Session ended. Please sign in again",
            "error_generic": "Something went wrong. Please try again"
        },
        "recovery": {
            "title": "Account deactivated",
            "description": "Your account was deleted on {date}. It will be permanently removed in {days} days.",
            "restore_button": "Restore account",
            "logout_button": "Sign out",
            "restored": "Account restored!"
        }
    }
}
```

**Примітка:** ці ключі додаються до існуючих `uk.json` / `en.json`, не замінюють їх.

---

## Verification

1. Signin page: email → checkEmail → Scenario A (password form з show/hide toggle + "Змінити" email)
2. Signin page: email → checkEmail → Scenario B (magic link sent, new user)
3. Signin page: email → checkEmail → Scenario C (magic link sent, existing user)
4. Signin page: "Змінити" email → повертає до кроку email
5. Signin page: password login → success → redirect
6. Signin page: password login → progressive lockout (5/10/20 спроб) → error з таймером
7. Signin page: forgot password → однаковий toast незалежно від існування email
8. Signin page: check-email rate limit → 429 після 10 запитів per-IP
9. Verify page: purpose routing (register, login, reset-password, delete-account)
10. Recovery screen: restore account → success
