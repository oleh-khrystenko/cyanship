# Sprint: Terms Consent — Tracking, Re-acceptance & Extended Coverage

> Закрити правову прогалину: зберігати факт і версію consent, вимагати re-acceptance при зміні terms, додати consent на account restore та checkout flows.

---

## Проблема

Зараз terms consent checkbox є на sign-in сторінці, але:

1. **Факт згоди нікуди не записується** — в User schema немає `termsAcceptedAt` чи `termsVersion`. Неможливо довести згоду в суді або під GDPR audit.
2. **Немає механізму re-acceptance** — при зміні Terms of Service існуючі юзери продовжують працювати без повторного підтвердження. Це порушення вимог GDPR та юридичних стандартів SaaS.
3. **Account restore без consent** — юзер відновлює deleted акаунт без підтвердження Terms, які могли змінитись за 30-day grace period.
4. **Checkout без payment terms** — EU юрисдикції вимагають окремого підтвердження payment terms при покупці, Stripe hosted checkout покриває лише свої terms, не наші.

---

## Цільовий стан

```
Sign-in → consent checkbox (вже є) → зберігається termsAcceptedAt + termsVersion
                                                    ↓
Account restore → consent checkbox → оновлюється termsAcceptedAt + termsVersion
                                                    ↓
Checkout (subscription/credits) → consent note з посиланнями → не блокує, але інформує
                                                    ↓
Terms updated (CURRENT_TERMS_VERSION змінено) → AuthInitializer детектує outdated version
    → modal re-acceptance → оновлюється termsAcceptedAt + termsVersion
    → без re-acceptance жоден protected action недоступний
```

**Ключові принципи:**

- `termsVersion` — ISO date string (`"2026-03-14"`), не semver. Міняється лише коли Terms або Privacy Policy змінюються
- `CURRENT_TERMS_VERSION` — константа в `@lucidship/types`, single source of truth
- Consent трекається і на backend, і на frontend
- Re-acceptance — soft block (modal), не hard block (logout)
- Checkout consent — інформаційний, не блокуючий (Stripe і так вимагає свої terms)

---

## Аналіз поточного коду

### Що міняється

| Шар | Файл | Зміна |
|---|---|---|
| **Types** | `packages/types/src/constants/terms.ts` | **NEW**: `CURRENT_TERMS_VERSION`, `TERMS_EFFECTIVE_DATE` |
| **Types** | `packages/types/src/entities/user.ts` | Додати `termsAcceptedAt`, `termsVersion` |
| **Types** | `packages/types/src/contracts/users.ts` | Новий `AcceptTermsSchema` |
| **Types** | `packages/types/src/index.ts` | Re-export `constants/terms` |
| **Backend** | `apps/api/src/modules/users/schemas/user.schema.ts` | Додати `termsAcceptedAt`, `termsVersion` поля |
| **Backend** | `apps/api/src/modules/users/users.service.ts` | Новий `acceptTerms()` метод |
| **Backend** | `apps/api/src/modules/users/users.controller.ts` | Новий `POST /users/me/accept-terms` endpoint |
| **Backend** | `apps/api/src/modules/auth/auth.service.ts` | В `handleGoogleAuth()`, `verifyMagicLink()`, `loginWithPassword()` — записувати consent |
| **Backend** | `apps/api/src/modules/auth/auth.controller.ts` | Прокинути `termsVersion` при login/register/google |
| **Frontend** | `apps/web/src/shared/api/auth.ts` | Передавати `termsVersion` при login |
| **Frontend** | `apps/web/src/shared/api/users.ts` | **NEW**: `acceptTerms()` функція |
| **Frontend** | `apps/web/src/app/[locale]/auth/signin/page.tsx` | Передавати `CURRENT_TERMS_VERSION` при submit |
| **Frontend** | `apps/web/src/app/[locale]/auth/callback/page.tsx` | Додати consent checkbox перед restore |
| **Frontend** | `apps/web/src/app/[locale]/(protected)/billing/page.tsx` | Додати terms note перед checkout |
| **Frontend** | `apps/web/src/features/auth/TermsReacceptModal.tsx` | **NEW**: modal для re-acceptance |
| **Frontend** | `apps/web/src/features/auth/AuthInitializer.tsx` | Перевірка `termsVersion` після getMe |
| **Frontend** | `apps/web/messages/uk.json` | Нові i18n ключі |
| **Frontend** | `apps/web/messages/en.json` | Нові i18n ключі |
| **E2E тести** | `apps/api/test/auth.e2e-spec.ts` | Перевірити consent запис при auth flows |

### Що НЕ міняється

- Sign-in page checkbox UI — вже існує, лише додається передача version
- Terms/Privacy page content — контент не міняється
- Existing auth flows — consent запис додається без зміни response format
- Guards — перевірка terms version на фронті, не на бекенді (soft block)
- Cookie/token механізм — без змін
- Middleware — без змін

---

## План імплементації

### Фаза 0: Types (packages/types)

**Крок 0.1 — Нова константа `CURRENT_TERMS_VERSION`**

Файл: `packages/types/src/constants/terms.ts` (NEW)

```typescript
/** ISO date when current Terms of Service / Privacy Policy became effective.
 *  Bump this value every time legal content changes.
 *  Format: YYYY-MM-DD */
export const CURRENT_TERMS_VERSION = '2026-03-14';
```

> Чому ISO date а не semver: юзери і юристи розуміють дати. Порівняння тривіальне (`string < string`). Не потрібна логіка major/minor/patch.

**Крок 0.2 — Додати поля в User entity**

Файл: `packages/types/src/entities/user.ts`

Додати в `UserSchema`:
```typescript
termsAcceptedAt: z.coerce.date().nullable().optional(),
termsVersion: z.string().nullable().optional(),
```

Додати в `UserProfileSchema.pick()`:
```typescript
termsVersion: true,
```

> `termsAcceptedAt` не потрібен на клієнті для логіки, але `termsVersion` потрібен для порівняння з `CURRENT_TERMS_VERSION`.

**Крок 0.3 — Нова схема `AcceptTermsSchema`**

Файл: `packages/types/src/contracts/users.ts`

```typescript
import { CURRENT_TERMS_VERSION } from '../constants/terms';

export const AcceptTermsSchema = z.object({
    termsVersion: z.literal(CURRENT_TERMS_VERSION),
});

export type AcceptTermsDto = z.infer<typeof AcceptTermsSchema>;
```

> `z.literal()` гарантує що клієнт відправляє саме поточну версію, не довільну.

**Крок 0.4 — Re-export**

Файл: `packages/types/src/index.ts`

Додати:
```typescript
export * from './constants/terms';
```

**Крок 0.5 — Збілдити types**

```bash
pnpm --filter @lucidship/types build
```

---

### Фаза 1: Backend — Schema та Service

**Крок 1.1 — Додати поля в Mongoose schema**

Файл: `apps/api/src/modules/users/schemas/user.schema.ts`

```typescript
@Prop({ type: Date, default: null })
termsAcceptedAt!: Date | null;

@Prop({ type: String, default: null })
termsVersion!: string | null;
```

> Обидва поля `null` за замовчуванням. Існуючі юзери отримають `null` — це сигнал для re-acceptance flow.

**Крок 1.2 — Метод `acceptTerms()` в UsersService**

Файл: `apps/api/src/modules/users/users.service.ts`

```typescript
async acceptTerms(userId: string, termsVersion: string): Promise<void> {
    await this.userModel.updateOne(
        { _id: userId },
        {
            $set: {
                termsAcceptedAt: new Date(),
                termsVersion,
            },
        },
    );
}
```

**Крок 1.3 — Метод `recordConsent()` (внутрішній, для auth flows)**

Той самий `acceptTerms()` викликається з auth service при login/register. Не потрібен окремий метод — `acceptTerms()` ідемпотентний.

---

### Фаза 2: Backend — Auth integration

**Крок 2.1 — Записувати consent при login/register**

Зміни в `auth.service.ts`:

**`handleGoogleAuth()`** — після `findOrCreateByGoogle()`:
```typescript
// Consent записується на фронті через окремий endpoint після OAuth redirect,
// бо Google OAuth redirect не передає body.
// Тому для Google flow: consent запишеться через POST /users/me/accept-terms
// який фронтенд викличе після callback.
```

> Важливе рішення: Google OAuth НЕ може передати `termsVersion` в redirect flow. Consent для Google записується окремим POST після callback, а не в самому OAuth flow.

**`loginWithPassword()`** — додати параметр `termsVersion?: string`:
```typescript
async loginWithPassword(
    email: string,
    password: string,
    ip: string,
    termsVersion?: string,
): Promise<LoginResult> {
    // ... existing login logic ...
    if (termsVersion) {
        await this.usersService.acceptTerms(user._id.toString(), termsVersion);
    }
    // ... return result ...
}
```

**`verifyMagicLink()`** — magic link verify не потребує зміни, бо consent вже записаний при відправці magic link (send flow починається з signin page де є checkbox). Але для safety — записувати consent в verify якщо передано.

**Крок 2.2 — Оновити auth controller**

Файл: `apps/api/src/modules/auth/auth.controller.ts`

`POST /auth/login/password` — прокинути `dto.termsVersion`:
```typescript
const { user, accessToken, refreshToken, accountDeleted } =
    await this.authService.loginWithPassword(
        dto.email, dto.password, ip, dto.termsVersion,
    );
```

**Крок 2.3 — Оновити login DTO**

Файл: `packages/types/src/contracts/auth.ts`

Додати optional `termsVersion` в `LoginPasswordSchema`:
```typescript
export const LoginPasswordSchema = z.object({
    email: emailSchema,
    password: z.string().min(1),
    termsVersion: z.string().optional(),
});
```

---

### Фаза 3: Backend — Accept Terms endpoint

**Крок 3.1 — Новий endpoint**

Файл: `apps/api/src/modules/users/users.controller.ts`

```typescript
@Post('me/accept-terms')
@UseGuards(JwtActiveGuard)
async acceptTerms(
    @CurrentUser() user: UserDocument,
    @Body() dto: AcceptTermsDto,
): Promise<ApiMessageResponse> {
    await this.usersService.acceptTerms(user._id.toString(), dto.termsVersion);
    return {
        data: {
            code: RESPONSE_CODE.TERMS_ACCEPTED,
            message: 'Terms accepted',
        },
    };
}
```

**Крок 3.2 — Новий response code**

Файл: `packages/types/src/enums/response-code.ts`

Додати `TERMS_ACCEPTED: 'TERMS_ACCEPTED'` в секцію users success. Додати маппінг `TERMS_ACCEPTED → SUCCESS` в `RESPONSE_CODE_TYPE`.

**Крок 3.3 — DTO**

Файл: `apps/api/src/modules/users/dto/accept-terms.dto.ts` (NEW)

```typescript
import { createZodDto } from 'nestjs-zod';
import { AcceptTermsSchema } from '@lucidship/types';

export class AcceptTermsDto extends createZodDto(AcceptTermsSchema) {}
```

---

### Фаза 4: Backend — Expose termsVersion в getMe

**Крок 4.1 — Додати termsVersion у відповідь getMe**

Файл: `apps/api/src/modules/users/users.controller.ts`

В `getMe()` response додати:
```typescript
termsVersion: user.termsVersion ?? null,
```

> Не exposимо `termsAcceptedAt` клієнту — він не потрібен для UI логіки. `termsVersion` достатньо для порівняння.

---

### Фаза 5: Frontend — API та типи

**Крок 5.1 — API функція `acceptTerms()`**

Файл: `apps/web/src/shared/api/users.ts` (NEW або додати в існуючий)

```typescript
import { CURRENT_TERMS_VERSION } from '@lucidship/types';
import { apiClient } from './client';

export async function acceptTerms(): Promise<void> {
    await apiClient.post('/users/me/accept-terms', {
        termsVersion: CURRENT_TERMS_VERSION,
    });
}
```

**Крок 5.2 — Передавати termsVersion при password login**

Файл: `apps/web/src/shared/api/auth.ts`

В `loginWithPassword()` додати `termsVersion`:
```typescript
export async function loginWithPassword(email: string, password: string) {
    const { data } = await apiClient.post('/auth/login/password', {
        email,
        password,
        termsVersion: CURRENT_TERMS_VERSION,
    });
    return data.data;
}
```

---

### Фаза 6: Frontend — Sign-in page (мінімальні зміни)

**Крок 6.1 — Consent вже передається неявно**

Файл: `apps/web/src/app/[locale]/auth/signin/page.tsx`

Password login: `loginWithPassword()` тепер автоматично відправляє `CURRENT_TERMS_VERSION` (зміна в Фазі 5.2).

Magic link: consent записується при першому `POST /auth/login/password` або через re-acceptance modal. Magic link flow фіксується через `acceptTerms()` виклик після verify.

Google OAuth: consent записується через `acceptTerms()` виклик після callback redirect (Фаза 7).

> Signin page UI не потребує змін. Checkbox вже є, version тепер передається автоматично через API функції.

---

### Фаза 7: Frontend — Callback page (Google OAuth consent)

**Крок 7.1 — Записати consent після Google OAuth callback**

Файл: `apps/web/src/app/[locale]/auth/callback/page.tsx`

В `authenticate()` після успішного `getMe()`, викликати `acceptTerms()`:

```typescript
const authenticate = async () => {
    try {
        await refreshToken();

        if (isAccountDeleted) {
            useAuthStore.getState().clearUser();
            setAccountDeleted(true);
            return;
        }

        const user = await getMe();
        useAuthStore.getState().setUser(user);

        // Record terms consent for Google OAuth flow
        // (sign-in page checkbox was checked before redirect)
        await acceptTerms();

        router.replace(`/${locale}/profile`);
    } catch {
        router.replace(`/${locale}/auth/signin`);
    }
};
```

> Це працює тому що юзер вже поставив checkbox на sign-in перед redirect до Google. `acceptTerms()` фіксує цей факт у БД. Якщо виклик впаде — не критично, re-acceptance modal зловить.

---

### Фаза 8: Frontend — Account Restore consent

**Крок 8.1 — Callback page: consent перед restore**

Файл: `apps/web/src/app/[locale]/auth/callback/page.tsx`

Додати `agreedToTerms` state та checkbox перед кнопкою restore:

```typescript
const [agreedToTerms, setAgreedToTerms] = useState(false);
const [termsError, setTermsError] = useState('');

const handleRestore = async () => {
    if (!agreedToTerms) {
        setTermsError(t('terms_required'));
        return;
    }
    setSubmitting(true);
    try {
        await restoreAccount();
        await acceptTerms(); // Record fresh consent
        toast.success(tRecovery('restored'));
        const user = await getMe();
        useAuthStore.getState().setUser(user);
        router.replace(`/${locale}/profile`);
    } catch {
        setSubmitting(false);
        router.replace(`/${locale}/auth/signin`);
    }
};
```

UI: checkbox з тим самим текстом що й на sign-in (`terms_agree` rich text).

**Крок 8.2 — Signin page: consent перед restore**

Файл: `apps/web/src/app/[locale]/auth/signin/page.tsx`

Recovery state: `handleRestore()` вже має доступ до `agreedToTerms` (checkbox є в email state, але recovery state рендериться окремо). Додати окремий checkbox в `renderRecoveryState()`:

```typescript
const renderRecoveryState = () => (
    <div className="space-y-4">
        <p className="text-muted-foreground text-center">
            {tRecovery('description', { date: deletedAt ?? '', days: deletedDaysLeft })}
        </p>

        <UiCheckbox
            checked={agreedToTerms}
            onChange={handleTermsChange}
            size="sm"
            error={termsError}
        >
            {t.rich('terms_agree', { terms: ..., privacy: ... })}
        </UiCheckbox>

        <UiButton ... onClick={handleRestore}>
            ...
        </UiButton>
    </div>
);
```

В `handleRestore()` додати перевірку `agreedToTerms` та `acceptTerms()`.

---

### Фаза 9: Frontend — Re-acceptance Modal

**Крок 9.1 — TermsReacceptModal компонент**

Файл: `apps/web/src/features/auth/TermsReacceptModal.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CURRENT_TERMS_VERSION } from '@lucidship/types';
import UiButton from '@/shared/ui/UiButton';
import UiCheckbox from '@/shared/ui/UiCheckbox';
import UiSpinner from '@/shared/ui/UiSpinner';
import { acceptTerms } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

interface Props {
    open: boolean;
    onAccepted: () => void;
}

export function TermsReacceptModal({ open, onAccepted }: Props) {
    const t = useTranslations('components.terms_reaccept');
    const locale = useLocale();
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const handleSubmit = async () => {
        if (!agreed) { setError(t('required')); return; }
        setSubmitting(true);
        try {
            await acceptTerms();
            // Update local user object
            const store = useAuthStore.getState();
            if (store.user) {
                store.setUser({ ...store.user, termsVersion: CURRENT_TERMS_VERSION });
            }
            onAccepted();
        } catch {
            setError(t('error'));
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card mx-4 max-w-md rounded-xl p-8 shadow-xl space-y-6">
                <h2 className="text-foreground text-xl font-bold">{t('title')}</h2>
                <p className="text-muted-foreground text-sm">{t('description')}</p>

                <UiCheckbox checked={agreed} onChange={(v) => { setAgreed(v); if (v) setError(''); }} error={error}>
                    {t.rich('agree', { terms: ..., privacy: ... })}
                </UiCheckbox>

                <UiButton variant="filled" size="lg" className="w-full justify-center" disabled={submitting} onClick={handleSubmit}>
                    {submitting ? <UiSpinner size="sm" /> : t('button')}
                </UiButton>
            </div>
        </div>
    );
}
```

> Рішення НЕ використовувати Radix Dialog: modal блокуючий, юзер не може його закрити. Простий overlay з div достатній. Backdrop не клікабельний.

**Крок 9.2 — Інтеграція з AuthInitializer**

Файл: `apps/web/src/features/auth/AuthInitializer.tsx`

Після успішного `getMe()` та `setUser()`:

```typescript
// Check if terms re-acceptance is needed
if (user.termsVersion !== CURRENT_TERMS_VERSION) {
    // Set flag in auth store to show re-acceptance modal
    useAuthStore.getState().setTermsOutdated(true);
}
```

**Крок 9.3 — Додати `termsOutdated` в authStore**

Файл: `apps/web/src/stores/auth/authStore.ts`

```typescript
interface AuthState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    termsOutdated: boolean;  // NEW
    setUser: (user: UserProfile) => void;
    clearUser: () => void;
    setTermsOutdated: (value: boolean) => void;  // NEW
}
```

**Крок 9.4 — Рендер modal в layout**

Файл: `apps/web/src/app/[locale]/layout.tsx`

```typescript
const termsOutdated = useAuthStore((s) => s.termsOutdated);

// В JSX, після Header:
<TermsReacceptModal
    open={termsOutdated}
    onAccepted={() => useAuthStore.getState().setTermsOutdated(false)}
/>
```

> Modal рендериться на рівні layout, щоб блокувати будь-яку взаємодію з app. Зникає тільки після успішного `acceptTerms()`.

---

### Фаза 10: Frontend — Billing page consent note

**Крок 10.1 — Інформаційний блок перед checkout**

Файл: `apps/web/src/app/[locale]/(protected)/billing/page.tsx`

Перед кнопкою Subscribe та перед кожним Buy credit pack — текстовий блок:

```typescript
<p className="text-muted-foreground text-xs">
    {t.rich('checkout_terms_note', {
        terms: (chunks) => (
            <a href={`/${locale}/terms`} target="_blank" className="text-primary underline hover:no-underline">
                {chunks}
            </a>
        ),
    })}
</p>
```

i18n key:
```json
"checkout_terms_note": "By proceeding, you confirm that you agree to the <terms>payment terms</terms>."
```

> Не блокуючий — не checkbox, а текст. Stripe hosted checkout вже має свої terms. Цього достатньо для EU compliance при redirect-based checkout.

---

### Фаза 11: i18n

**Крок 11.1 — Нові ключі**

Файл: `apps/web/messages/en.json`

```json
"components": {
    "terms_reaccept": {
        "title": "Updated terms",
        "description": "Our Terms of Service or Privacy Policy have been updated. Please review and accept the changes to continue.",
        "agree": "I agree to the updated <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>",
        "button": "Accept and continue",
        "required": "You must accept the updated terms to continue.",
        "error": "Something went wrong. Please try again."
    }
},
"billing_page": {
    "checkout_terms_note": "By proceeding, you confirm that you agree to the <terms>payment terms</terms>."
}
```

Файл: `apps/web/messages/uk.json`

```json
"components": {
    "terms_reaccept": {
        "title": "Оновлені умови",
        "description": "Наші Умови використання або Політика конфіденційності були оновлені. Перегляньте та прийміть зміни для продовження роботи.",
        "agree": "Я погоджуюсь з оновленими <terms>Умовами використання</terms> та <privacy>Політикою конфіденційності</privacy>",
        "button": "Прийняти та продовжити",
        "required": "Необхідно прийняти оновлені умови для продовження.",
        "error": "Щось пішло не так. Спробуйте ще раз."
    }
},
"billing_page": {
    "checkout_terms_note": "Продовжуючи, ви підтверджуєте згоду з <terms>умовами оплати</terms>."
}
```

Також додати notification ключі:
```json
"notifications.users.terms_accepted": "Terms accepted." // en
"notifications.users.terms_accepted": "Умови прийнято." // uk
```

---

### Фаза 12: E2E тести

**Крок 12.1 — Consent при auth flows**

Файл: `apps/api/test/auth.e2e-spec.ts`

```
describe('Terms consent tracking', () => {

    it('should record termsVersion on password login when provided')
    - POST /auth/login/password { email, password, termsVersion: CURRENT_TERMS_VERSION }
    - GET /users/me → termsVersion === CURRENT_TERMS_VERSION

    it('should not fail login when termsVersion is not provided')
    - POST /auth/login/password { email, password }
    - Expect 200 (backward compatible)

    it('should accept terms via dedicated endpoint')
    - POST /users/me/accept-terms { termsVersion: CURRENT_TERMS_VERSION }
    - Expect 200, code: TERMS_ACCEPTED
    - GET /users/me → termsVersion === CURRENT_TERMS_VERSION

    it('should reject accept-terms with wrong version')
    - POST /users/me/accept-terms { termsVersion: '2020-01-01' }
    - Expect 400 (Zod literal validation)

    it('should expose termsVersion in getMe response')
    - GET /users/me → response contains termsVersion field
});
```

---

## Файли — повний список змін

```
packages/types/src/
├── constants/terms.ts              # NEW: CURRENT_TERMS_VERSION
├── constants/index.ts              # Re-export terms
├── entities/user.ts                # +termsAcceptedAt, +termsVersion fields
├── contracts/users.ts              # +AcceptTermsSchema
├── enums/response-code.ts          # +TERMS_ACCEPTED code
└── index.ts                        # Re-export constants/terms

apps/api/src/modules/
├── users/
│   ├── schemas/user.schema.ts      # +termsAcceptedAt, +termsVersion Mongoose fields
│   ├── users.service.ts            # +acceptTerms() method
│   ├── users.controller.ts         # +POST /users/me/accept-terms, +termsVersion in getMe
│   └── dto/accept-terms.dto.ts     # NEW: createZodDto(AcceptTermsSchema)
└── auth/
    ├── auth.service.ts             # +termsVersion param in loginWithPassword
    └── auth.controller.ts          # +прокинути termsVersion

apps/web/src/
├── shared/api/
│   ├── auth.ts                     # +termsVersion in loginWithPassword
│   └── users.ts                    # NEW or extended: +acceptTerms()
├── stores/auth/authStore.ts        # +termsOutdated, +setTermsOutdated
├── features/auth/
│   ├── AuthInitializer.tsx         # +termsVersion check → setTermsOutdated
│   └── TermsReacceptModal.tsx      # NEW: re-acceptance modal
├── app/[locale]/
│   ├── layout.tsx                  # +TermsReacceptModal render
│   ├── auth/
│   │   ├── signin/page.tsx         # +consent checkbox in recovery state, +acceptTerms in restore
│   │   └── callback/page.tsx       # +acceptTerms after OAuth, +consent in restore
│   └── (protected)/billing/page.tsx # +checkout terms note

apps/web/messages/
├── uk.json                         # +components.terms_reaccept, +billing_page.checkout_terms_note
└── en.json                         # +components.terms_reaccept, +billing_page.checkout_terms_note

apps/api/test/
└── auth.e2e-spec.ts                # +terms consent tracking tests
```

---

## API зміни

### Новий endpoint

| Method | Path | Guard | Request | Response |
|---|---|---|---|---|
| POST | `/api/users/me/accept-terms` | JwtActiveGuard | `{ termsVersion: "2026-03-14" }` | `{ data: { code: 'TERMS_ACCEPTED', message: 'Terms accepted' } }` |

### Змінені endpoints

| Method | Path | Зміна |
|---|---|---|
| POST | `/api/auth/login/password` | +optional `termsVersion` в body |
| GET | `/api/users/me` | +`termsVersion` у відповіді |

---

## Чеклист конвенцій

- [ ] Zod = single source of truth — AcceptTermsSchema в packages/types, DTO через createZodDto()
- [ ] Fail-fast — нових env vars немає
- [ ] API response format — `{ data: { code, message } }` для accept-terms
- [ ] Tone: classic-polite — в i18n ключах, формальне "ви"
- [ ] UI primitives — UiCheckbox, UiButton, UiSpinner в modal
- [ ] Design tokens — кольори через token classes
- [ ] i18n — всі тексти через useTranslations()
- [ ] Modular boundaries — TermsReacceptModal в features/auth (core), не agency
- [ ] Single source of truth — CURRENT_TERMS_VERSION в @lucidship/types
- [ ] Privacy Policy — NOTE в user.schema.ts нагадує оновити PP при зміні полів (termsAcceptedAt = user data)

---

## Залежності та ризики

| Ризик | Мітігація |
|---|---|
| Існуючі юзери мають `termsVersion: null` | Re-acceptance modal спрацює при першому логіні після деплою. `null !== CURRENT_TERMS_VERSION` → modal |
| Google OAuth не може передати body | `acceptTerms()` викликається окремо після callback. Якщо впаде — modal зловить |
| Race condition: юзер закриє вкладку до acceptTerms | Наступний візит → AuthInitializer → modal знову з'явиться |
| `z.literal(CURRENT_TERMS_VERSION)` зламає старі клієнти | Literal оновлюється разом з types build. Фронт і бекенд деплояться одночасно |
| Soft block (modal) vs hard block (backend guard) | Soft block достатній для SaaS. Hard block (403 для outdated terms) — оверінжинірінг, бо вимагає виключень для accept-terms, refresh, logout endpoints |
| Privacy Policy update: termsAcceptedAt = PII | Так, це timestamp + version. Додати в PP секцію "What We Collect" |

---

## Порядок виконання

```
Фаза 0: Types
  0.1 CURRENT_TERMS_VERSION constant
  0.2 User entity: +termsAcceptedAt, +termsVersion
  0.3 AcceptTermsSchema
  0.4 TERMS_ACCEPTED response code
  0.5 Build types
      ↓
Фаза 1: Backend schema + service
  1.1 Mongoose: +termsAcceptedAt, +termsVersion
  1.2 UsersService.acceptTerms()
      ↓
Фаза 2: Backend auth integration
  2.1 loginWithPassword +termsVersion param
  2.2 Auth controller: прокинути termsVersion
  2.3 Login DTO: +optional termsVersion
      ↓
Фаза 3: Backend accept-terms endpoint      ← може паралельно з Фазою 2
  3.1 POST /users/me/accept-terms
  3.2 DTO
      ↓
Фаза 4: Backend getMe +termsVersion
      ↓
Фаза 5: Frontend API functions              ← блокується Фазами 2-4
  5.1 acceptTerms()
  5.2 loginWithPassword +termsVersion
      ↓
Фаза 6-8: Frontend pages                    ← паралельно
  6.1 Sign-in (мінімально — implicit через API)
  7.1 Callback (+acceptTerms, +restore consent)
  8.1-8.2 Restore consent (signin + callback)
      ↓
Фаза 9: Re-acceptance modal                 ← блокується Фазою 5
  9.1 TermsReacceptModal
  9.2 AuthInitializer check
  9.3 authStore +termsOutdated
  9.4 Layout render
      ↓
Фаза 10: Billing consent note               ← незалежна, паралельно з Фазою 9
      ↓
Фаза 11: i18n                               ← блокує Фази 6-10 частково
      ↓
Фаза 12: E2E тести                          ← після всіх backend фаз
```

**Критичний шлях:** Types → Backend (schema + service + endpoint + getMe) → Frontend API → Re-acceptance modal + AuthInitializer.

**Паралелізм:** Фази 6, 7, 8 паралельно між собою. Фаза 10 незалежна від 6-9. i18n можна готувати паралельно з backend.

---

## Migration notes

- **Backward compatible**: всі нові поля nullable, login працює без termsVersion
- **Не потрібна DB migration**: MongoDB schemaless, нові поля з'являються при першому write
- **Rollback**: видалення полів безпечне, фронт перестає показувати modal, бекенд ігнорує termsVersion
- **Поточна CURRENT_TERMS_VERSION**: `2026-03-14` (дата коли Terms/Privacy вперше потребують tracking)
