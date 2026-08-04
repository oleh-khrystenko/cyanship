# Frontend — Billing Page

Файли:
- `apps/web/src/app/[locale]/(protected)/billing/page.tsx`
- `apps/web/src/app/[locale]/(protected)/billing/success/page.tsx`
- `apps/web/src/app/[locale]/(protected)/billing/cancel/page.tsx`
- `apps/web/src/app/[locale]/(protected)/billing/layout.tsx`
- `apps/web/src/shared/api/payments.ts`

## Billing Page

Protected route (AuthGuard). При монтуванні тягне `getCatalog()` — плани і пакети приходять зі Stripe, у коді їх немає. Поки каталог вантажиться, обидві секції приховані; помилка запиту → toast `catalog_error`.

Дві незалежних секції, контрольованих константами-прапорцями (`packages/types/src/constants/payments.ts`):

### Subscription Section (PAYMENTS_SUBSCRIPTION_ENABLED)

**Стан: немає підписки** (`hasActiveSubscription !== true`)

- Картка на кожен план з `catalog.subscriptionPlans` — ціна, кількість executions за період, featured-виділення
- Кнопка "Підписатись" → `createSubscriptionCheckout(plan.code)` → `window.location.assign(checkoutUrl)`

**Стан: є підписка** (`hasActiveSubscription === true`)

- Заголовок "Активна підписка"
- Статус: "Активна" або "Скасовується {дата}" (якщо `cancelAtPeriodEnd`)
- Plan code, дата наступного списання (якщо не cancelAtPeriodEnd)
- Попередження при cancelAtPeriodEnd
- Кнопка "Керувати підпискою" → `createPortalSession()` → `window.location.assign(portalUrl)` (Stripe Billing Portal)

### Executions Section (PAYMENTS_ONE_OFF_ENABLED)

- Заголовок, опис
- Поточний баланс: `user.executions.balance`
- Список пакетів з `catalog.executionPacks` (`basic`, `max`):
  - Для кожного — ціна, кількість executions + кнопка "Купити"
  - Клік → `createOneOffCheckout(pack.code)` → `window.location.assign(checkoutUrl)`

### Loading state

`loadingAction` — рядок що відслідковує яка дія зараз виконується:
- `'portal'`, `` `subscribe_${planCode}` ``, `` `oneoff_${packCode}` ``
- Кнопка показує spinner, disabled для поточної дії

## Success Page

`/{locale}/billing/success`

1. `getMe()` → оновлення Zustand store (щоб billing state актуалізувався)
2. Toast success
3. Redirect на `returnPath` з query або на `/{locale}/billing`

Якщо `getMe()` впав — toast error, redirect усе одно відбувається. `returnPath` приймається лише як відносний шлях (`/…`, але не `//…`) — захист від open redirect.

## Cancel Page

`/{locale}/billing/cancel`

1. Toast info "Скасовано"
2. Redirect на `returnPath` або `/{locale}/billing` (та сама перевірка шляху)

## Frontend API functions

Файл: `apps/web/src/shared/api/payments.ts`

```typescript
getCatalog(): Promise<PaymentsCatalog>
createSubscriptionCheckout(planCode: string, returnPath?: string): Promise<{ checkoutUrl: string }>
createOneOffCheckout(packCode: string, returnPath?: string): Promise<{ checkoutUrl: string }>
createPortalSession(): Promise<{ portalUrl: string }>
resetBilling(): Promise<void>
```

Всі використовують `apiClient` — access token додається автоматично через interceptor.

## Інші споживачі прапорців

- `app/[locale]/(protected)/dashboard/page.tsx` — блок статусу підписки за `PAYMENTS_SUBSCRIPTION_ENABLED`
- `features/agency/proof/ui/ProofBilling` — демо-версія тієї ж сторінки на agency-лендингу; за обома прапорцями вирішує, чи показувати перемикач вкладок

## Executions Badge (Header)

Баланс executions також відображається в header як badge біля аватарки (widget header).
