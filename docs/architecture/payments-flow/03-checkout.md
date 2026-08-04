# Checkout — підписка та пакети executions

Файл: `apps/api/src/modules/payments/payments.service.ts` (createCheckoutSession)

## Два типи платежів

Система підтримує два незалежних типи платежів, контрольованих feature flags:

### 1. Subscription (підписка)

- `paymentType: 'subscription'`
- `planCode: 'starter' | 'pro'` — `SUBSCRIPTION_PLAN_CODES` у `packages/types/src/contracts/payments.ts`
- Stripe Checkout mode: `subscription`
- Price ID: `CatalogService.getSubscriptionPlan(planCode).priceId` — зі Stripe, не з env
- **Валідація:** якщо `user.billing?.hasActiveSubscription === true` -> 409 ALREADY_SUBSCRIBED; невідомий `planCode` (немає в каталозі) -> 400 `Invalid planCode`

### 2. One-off (пакети executions)

- `paymentType: 'one_off'`
- `packCode: 'basic' | 'max'` — `EXECUTION_PACK_CODES` у `packages/types/src/contracts/payments.ts`
- Stripe Checkout mode: `payment`
- Price ID: `CatalogService.getExecutionPack(packCode).priceId` — зі Stripe, не з env
- **Валідація:** packCode повинен існувати в каталозі, інакше 400 `Invalid packCode`

## Звідки беруться ціни і кількість executions

Ніяких `STRIPE_PRICE_ID_*` env vars немає. Коди планів і пакетів — це структурні ідентифікатори (i18n-ключі, зображення, записи в БД), а бізнес-дані читаються з metadata Stripe Products через `CatalogService` (Redis-кеш, TTL 5 хв):

```typescript
// CatalogService.getSubscriptionPlan('pro') / getExecutionPack('basic')
{ code, priceId, priceAmount, currency, executions, displayOrder, featured }
```

`PaymentsService` бере звідти `priceId` і `executions` та передає їх у `IPaymentProvider.createCheckoutSession()`. Деталі каталогу — [13-catalog.md](./13-catalog.md).

Пакети доступні тільки коли константа `PAYMENTS_ONE_OFF_ENABLED` (`packages/types/src/constants/payments.ts`) = `true`.

## Stripe Checkout Session

Файл: `apps/api/src/modules/payments/providers/stripe.service.ts` (createCheckoutSession)

Параметри Stripe session:

| Параметр | Значення |
|----------|----------|
| mode | `subscription` або `payment` |
| payment_method_types | `['card']` |
| customer | `providerCustomerId` (якщо є) |
| customer_email | `user.email` (якщо немає customer) |
| line_items | `[{ price: priceId, quantity: 1 }]` |
| metadata | `{ userId, planCode, executions }` (`executions` — рядок) |
| client_reference_id | `userId` |
| success_url | `{WEB_URL}/{locale}/billing/success` |
| cancel_url | `{WEB_URL}/{locale}/billing/cancel` |

`locale` — `user.preferredLang`. Обидва URL збирає `PaymentsService`, а не провайдер; якщо в DTO прийшов `returnPath`, він додається як query-параметр (`?returnPath=...`), щоб після оплати повернути юзера туди, звідки він почав checkout.

## Post-checkout redirect

Після оплати Stripe редіректить на:

- **Success:** `/{locale}/billing/success` -> `getMe()` -> оновлення store -> toast success -> redirect на `returnPath` або `/{locale}/billing`
- **Cancel:** `/{locale}/billing/cancel` -> toast info -> redirect на `returnPath` або `/{locale}/billing`

Обидві сторінки приймають `returnPath` тільки як відносний шлях (`/…`, але не `//…`) — інакше ігнорують його і ведуть на `/{locale}/billing`. Це захист від open redirect, бо значення приходить з URL.
