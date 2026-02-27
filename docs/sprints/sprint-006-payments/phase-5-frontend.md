# Phase 5 — Frontend

> Залежить від: Phase 3 (Payments Core) + Phase 4 (Access Guard).
> Перед початком прочитай:
> - `apps/web/src/shared/api/auth.ts` — патерн API client functions
> - `apps/web/src/shared/api/client.ts` — axios instance + interceptors
> - `apps/web/src/app/[locale]/(protected)/profile/page.tsx` — патерн protected page
> - `apps/web/src/middleware.ts` — route protection
> - `apps/web/src/stores/auth/authStore.ts` — Zustand store
> - `apps/web/src/shared/ui/` — UI component patterns (UiButton, UiSpinner)
> - `apps/web/messages/uk.json`, `apps/web/messages/en.json` — i18n (після Phase 4)

## Мета

Створити MVP billing page: статус підписки + кнопка checkout + кнопка manage (portal). Після цієї фази юзер може підписатись та керувати підпискою через UI.

## Constraints

1. **Feature-Sliced Design:** page в `app/[locale]/(protected)/billing/`, shared API в `shared/api/`.
2. **Server components за замовчуванням.** `'use client'` тільки де потрібно (інтерактивні елементи).
3. **i18n через `useTranslations()`.** Ніяких hardcoded strings.
4. **Existing UI components.** `UiButton`, `UiSpinner` — не створювати нові.
5. **Tone convention.** Формальне "ви", без емодзі.
6. **Billing data з auth store.** Розширити `authStore` полем `billing` з `getMe()` response.

## Крок 1: API client functions

**Файл:** `apps/web/src/shared/api/payments.ts` — **NEW**

```typescript
import { apiClient } from './client';

export async function createCheckoutSession(planCode: string): Promise<{ checkoutUrl: string }> {
    const { data } = await apiClient.post<{ data: { checkoutUrl: string } }>(
        '/api/payments/checkout-session',
        { planCode },
    );
    return data.data;
}

export async function createPortalSession(): Promise<{ portalUrl: string }> {
    const { data } = await apiClient.post<{ data: { portalUrl: string } }>(
        '/api/payments/portal-session',
    );
    return data.data;
}
```

**Файл:** `apps/web/src/shared/api/index.ts` — **EDIT**

Додати:

```typescript
export * from './payments';
```

## Крок 2: Auth store — billing field

**Файл:** `apps/web/src/stores/auth/authStore.ts` — **EDIT**

Розширити user type полем `billing`:

```typescript
// В типі user додати:
billing?: {
    hasActiveSubscription: boolean;
    planCode: string | null;
    subscriptionStatus: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
} | null;
```

> **Примітка:** `getMe()` response з API вже містить billing field (після Phase 3 змін в User schema). Store автоматично отримає його.

## Крок 3: Backend — розширити getMe response

**Файл:** `apps/api/src/modules/users/users.controller.ts` — **EDIT**

В `getMe()` endpoint додати billing field до response:

```typescript
// Додати в return { data: { ... } }:
billing: user.billing ? {
    hasActiveSubscription: user.billing.hasActiveSubscription,
    planCode: user.billing.planCode,
    subscriptionStatus: user.billing.subscriptionStatus,
    currentPeriodEnd: user.billing.currentPeriodEnd,
    cancelAtPeriodEnd: user.billing.cancelAtPeriodEnd,
} : null,
```

> **Примітка:** НЕ повертати `providerCustomerId`, `providerSubscriptionId`, `providerSubscriptionStatus` — це internal billing data, не потрібна на frontend.

## Крок 4: Middleware — protected route

**Файл:** `apps/web/src/middleware.ts` — **EDIT**

Додати `/billing` до protected paths (поряд з `/profile`, `/pay`):

```typescript
// В масив protected paths:
'/billing',
```

## Крок 5: Billing page

**Файл:** `apps/web/src/app/[locale]/(protected)/billing/page.tsx` — **NEW**

Сторінка має 2 стани:

### Стан A: Немає підписки (`!billing?.hasActiveSubscription`)

```
┌─────────────────────────────────────────┐
│           Оформіть підписку             │
│                                         │
│  Отримайте доступ до AI-аналізу         │
│  автомобілів.                           │
│                                         │
│  Plan: Monthly — $XX/mo                 │
│                                         │
│  [ Оформити підписку ]  (UiButton)      │
│                                         │
└─────────────────────────────────────────┘
```

- Кнопка "Оформити підписку" → `createCheckoutSession('monthly_usd')` → `window.location.href = checkoutUrl`
- Loading state на кнопці під час API call
- Error handling через toast (sonner)

### Стан B: Є підписка (`billing?.hasActiveSubscription`)

```
┌─────────────────────────────────────────┐
│           Ваша підписка                 │
│                                         │
│  Статус: Активна                        │
│  План: Monthly                          │
│  Наступне списання: 15 березня 2026     │
│                                         │
│  [ Керувати підпискою ]  (UiButton)     │
│                                         │
└─────────────────────────────────────────┘
```

- Кнопка "Керувати підпискою" → `createPortalSession()` → `window.location.href = portalUrl`
- Відображати `cancelAtPeriodEnd` status: "Підписку буде скасовано {date}"
- Форматування дати через `Intl.DateTimeFormat` з locale

### Стан C: Canceled але ще активна (`cancelAtPeriodEnd === true`)

```
┌─────────────────────────────────────────┐
│           Ваша підписка                 │
│                                         │
│  Статус: Активна (до 15 березня 2026)   │
│  Підписку буде скасовано після          │
│  завершення поточного періоду.          │
│                                         │
│  [ Керувати підпискою ]  (UiButton)     │
│                                         │
└─────────────────────────────────────────┘
```

**Компонент:** `'use client'` — потребує `useTranslations`, `useAuthStore`, event handlers.

## Крок 6: i18n ключі для billing page

**Файл:** `apps/web/messages/uk.json` — **EDIT**

```json
{
    "billing_page": {
        "head": {
            "title": "Підписка"
        },
        "subscribe": {
            "title": "Оформіть підписку",
            "description": "Отримайте доступ до AI-аналізу автомобілів.",
            "plan_label": "План: Monthly",
            "button": "Оформити підписку"
        },
        "active": {
            "title": "Ваша підписка",
            "status_active": "Активна",
            "status_canceling": "Активна до {date}",
            "plan_label": "План: {plan}",
            "next_billing": "Наступне списання: {date}",
            "cancel_notice": "Підписку буде скасовано після завершення поточного періоду.",
            "manage_button": "Керувати підпискою"
        }
    }
}
```

**Файл:** `apps/web/messages/en.json` — **EDIT**

```json
{
    "billing_page": {
        "head": {
            "title": "Subscription"
        },
        "subscribe": {
            "title": "Subscribe",
            "description": "Get access to AI-powered vehicle analysis.",
            "plan_label": "Plan: Monthly",
            "button": "Subscribe"
        },
        "active": {
            "title": "Your subscription",
            "status_active": "Active",
            "status_canceling": "Active until {date}",
            "plan_label": "Plan: {plan}",
            "next_billing": "Next billing: {date}",
            "cancel_notice": "Your subscription will be canceled at the end of the current period.",
            "manage_button": "Manage subscription"
        }
    }
}
```

## Крок 7: SEO metadata

**Файл:** `apps/web/src/app/[locale]/(protected)/billing/page.tsx`

Додати `generateMetadata()` за патерном з profile page:

```typescript
export async function generateMetadata({ params }: PageParams) {
    const { locale } = await params;
    return fetchMetadata(locale, { titleKey: 'billing_page.head.title' });
}
```

> **Примітка:** Перевірити як `fetchMetadata` працює в profile page і повторити патерн.

## Крок 8: Header — billing link (optional)

Якщо потрібен quick access — додати посилання в Header widget для authenticated users. Це optional для MVP — може бути тільки прямий route `/billing`.

## Порядок виконання

```
1. Крок 1 — API client functions (NEW)
2. Крок 2 — Auth store billing field (EDIT)
3. Крок 3 — Backend getMe response (EDIT)
4. Крок 4 — Middleware protected route (EDIT)
5. Крок 6 — i18n keys (EDIT, перед page creation)
6. Крок 5 — Billing page (NEW)
7. Крок 7 — SEO metadata (part of page)
8. pnpm --filter web build — перевірити компіляцію
```

## Verification

1. `pnpm --filter api build` — без помилок (getMe зміна)
2. `pnpm --filter web build` — без помилок
3. `pnpm lint` — без помилок
4. `pnpm --filter api test` — існуючі тести проходять
5. `pnpm --filter web test` — існуючі тести проходять
6. Billing page доступна на `/uk/billing` та `/en/billing`
7. Незалогований юзер redirect на `/auth/signin` при спробі доступу до `/billing`
8. i18n ключі присутні в обох мовних файлах
9. API client functions не імпортують Stripe types — тільки generic request/response
