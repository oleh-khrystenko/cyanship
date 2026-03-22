# Sprint 02: Auth Window — авторизація у Proof секції

> Міні-авторизація в інтерактивному вікні секції Proof на лендінгу. Відвідувач може авторизуватись не покидаючи лендінг (або повернутись на нього після OAuth/magic link).

---

## Ключові рішення

### Redirect після Google OAuth
`saveRedirect('/${locale}#dogfooding')` перед `window.location.href` → callback page вже викликає `consumeRedirect()` (`apps/web/src/app/[locale]/auth/callback/page.tsx`, рядок 42) → юзер повертається на лендінг. **Змін у callback page не потрібно.**

### Redirect після Magic Link
`sendMagicLink(email, locale, 'login', '/${locale}#dogfooding')` → verify page вже читає `redirect` param (`apps/web/src/app/[locale]/auth/verify/page.tsx`, рядки 23-27) → юзер повертається на лендінг. **Змін у verify page не потрібно.**

### Юзер з паролем
`checkEmail()` → `hasPassword: true` → редірект на `/auth/signin?redirect=/${locale}#dogfooding`. Не дублюємо password form у віджеті — це scope creep (forgot password, rate limiting, magic link suggestion).

### Стейт-машина
Три стани: `idle` | `loading` | `magic-link-sent`. Мінімум порівняно з 6 станами signin page.

---

## Файли для зміни

### 1. `apps/web/src/features/agency/proof/ui/ProofAuth/ProofAuth.tsx`
Повний rewrite заглушки.

**Authenticated view:**
- `UiAvatar` (md) + `UiAvatarImage` / `UiAvatarFallback`
- Ім'я + email
- `UiButton` variant="outline" → `logout()` + `clearUser()`, без навігації

**Not-authenticated view (idle):**
- `UiCheckbox` (sm) з terms rich text (посилання на Terms/Privacy)
- `UiButton` з `GoogleIcon` — при кліку `saveRedirect()` → `window.location.href`
- Розділювач "or"
- `<form>`: `UiInput` type="email" + `UiButton` variant="filled" submit

**Not-authenticated view (loading):**
- `UiSpinner` по центру

**Not-authenticated view (magic-link-sent):**
- Повідомлення "Check your email" з виділеним email
- Кнопка resend з countdown (60s, як у signin page)
- Кнопка "Different email" → повернення до idle

**Email submit logic:**
```
checkEmail(email)
├── hasPassword → router.push(`/${locale}/auth/signin?redirect=/${locale}#dogfooding`)
└── !hasPassword → sendMagicLink(email, locale, purpose, `/${locale}#dogfooding`)
                    → setState('magic-link-sent')
На помилку → inline error через UiInput error prop
```

**Імпорти (все існуюче, нічого нового):**
- `useAuthStore` — `isAuthenticated`, `user`, `isLoading`, `clearUser`
- `checkEmail`, `sendMagicLink`, `logout` з `@/shared/api`
- `saveRedirect` з `@/shared/lib`
- `UiButton`, `UiInput`, `UiCheckbox`, `UiAvatar*`, `UiSpinner`
- `GoogleIcon` з `@/shared/icons`
- `ENV` з `@/shared/config`
- `useTranslations`, `useLocale`, `useRouter` з next-intl/next/navigation

### 2. `apps/web/messages/en.json`
Додати під `landing_page.dogfooding`:
```json
"proof_auth": {
    "terms_agree": "I agree to the <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>",
    "terms_required": "Please accept the Terms to continue",
    "google_button": "Sign in with Google",
    "or_divider": "or",
    "email_placeholder": "your@email.com",
    "continue_button": "Continue",
    "magic_link_sent_title": "Check your email",
    "magic_link_sent_description": "We sent a link to <bold>{email}</bold>.",
    "resend_button": "Resend",
    "resend_countdown": "Resend in {seconds}s",
    "other_email": "Use different email",
    "authenticated_greeting": "Signed in as",
    "logout_button": "Sign out"
}
```

### 3. `apps/web/messages/uk.json`
Українські еквіваленти тих самих ключів.

---

## Що НЕ змінюємо
- Backend — жодних змін
- `callback/page.tsx` — вже підтримує `consumeRedirect()`
- `verify/page.tsx` — вже підтримує `redirect` param
- `shared/api/auth.ts` — використовуємо існуючі функції
- `authStore` — використовуємо існуючий стейт

---

## Edge cases
- **AuthInitializer ще не закінчив** → `isLoading: true` → показуємо спіннер, не flashаємо форму
- **Scroll після redirect** → `#dogfooding` anchor + існуючий `scroll-mt-28` = браузер скролить сам
- **Terms state reset після OAuth return** → нормально, callback вже викликає `acceptTerms()`
- **Password user redirect** → повертається через `?redirect=` param який signin page підхопить через `saveRedirect`

---

## Верифікація
1. `pnpm --filter web build` — білд без помилок
2. Відкрити лендінг → scroll до Proof → Auth tab видно
3. Неавторизований: checkbox + Google + email форма
4. Ввести email нового юзера → magic-link-sent стан, countdown працює
5. Ввести email з паролем → редірект на /auth/signin
6. Google OAuth → повернення на лендінг#dogfooding авторизованим
7. Авторизований: аватар + name + email + logout кнопка
8. Logout → форма з'являється знову без перезавантаження
