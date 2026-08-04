# Типи та контракти

Файл: `packages/types/src/contracts/payments.ts`

## Enums

### PAYMENT_TYPE

```typescript
PAYMENT_TYPE = {
    SUBSCRIPTION: 'subscription',
    ONE_OFF: 'one_off',
}
```

### SUBSCRIPTION_STATUS

```typescript
SUBSCRIPTION_STATUS = {
    ACTIVE: 'ACTIVE',
    TRIALING: 'TRIALING',
    PAST_DUE: 'PAST_DUE',
    CANCELED: 'CANCELED',
    INCOMPLETE: 'INCOMPLETE',
    UNPAID: 'UNPAID',
    UNKNOWN: 'UNKNOWN',
}
```

### BILLING_EVENT_TYPE

```typescript
BILLING_EVENT_TYPE = {
    CHECKOUT_COMPLETED: 'CHECKOUT_COMPLETED',
    SUBSCRIPTION_UPDATED: 'SUBSCRIPTION_UPDATED',
    SUBSCRIPTION_DELETED: 'SUBSCRIPTION_DELETED',
    ONE_OFF_PAYMENT_COMPLETED: 'ONE_OFF_PAYMENT_COMPLETED',
}
```

## Plan/pack коди

```typescript
SUBSCRIPTION_PLAN_CODES = ['starter', 'pro'] as const;
EXECUTION_PACK_CODES = ['basic', 'max'] as const;
```

`SubscriptionPlanCode = 'starter' | 'pro'`, `ExecutionPackCode = 'basic' | 'max'`.

Це структурні ідентифікатори — i18n-ключі, імена зображень, значення в БД. Ціни, кількість executions, порядок відображення і featured-позначка тут не зберігаються: вони живуть у metadata Stripe Products (див. [13-catalog.md](./13-catalog.md)). Новий план = код тут + i18n-ключі + зображення + Stripe Product.

## Catalog types

Заповнюються `CatalogService` під час читання зі Stripe:

```typescript
SubscriptionPlanItem = { code, priceId, priceAmount, currency, interval, executions, displayOrder, featured }
ExecutionPackItem    = { code, priceId, priceAmount, currency, executions, displayOrder, featured }
PaymentsCatalog      = { subscriptionPlans: SubscriptionPlanItem[], executionPacks: ExecutionPackItem[] }
```

`priceAmount` — у центах, `currency` — ISO-код зі Stripe.

## Schemas

### CreateCheckoutSessionSchema

Плоский об'єкт з `.refine()`, не discriminated union:
- `paymentType: 'subscription' | 'one_off'`
- `planCode?: string`, `packCode?: string` — обидва optional на рівні типу
- `returnPath?: string` — мусить починатися з `/`, максимум 256 символів

`.refine()` вимагає `planCode` для `subscription` і `packCode` для `one_off`. Самі коди валідуються не схемою, а наявністю в каталозі — `PaymentsService` кидає `Invalid planCode` / `Invalid packCode`, якщо `CatalogService` такого не знає.

### UserBillingSchema

Zod schema для `user.billing` subdocument. Всі поля відповідають Mongoose schema. Використовується для типізації frontend response.

### BillingWebhookEventSchema

Canonical model для webhook events:

| Поле | Тип | Опис |
|------|-----|------|
| type | BillingEventType | Canonical event type |
| providerEventId | string | Stripe event ID |
| occurredAt | Date | `stripeEvent.created * 1000` |
| userId | string | З metadata або resolveUserId |
| subscriptionStatus | SubscriptionStatus? | Для subscription events |
| currentPeriodStart | Date? | Початок періоду |
| currentPeriodEnd | Date? | Кінець періоду |
| cancelAtPeriodEnd | boolean? | Скасування в кінці періоду |
| previousPriceId | string? | Попередній priceId — база для proration при зміні плану |
| scheduledPlanCode | string? | Код плану, на який заплановано перехід |
| scheduledChangeDate | Date? | Дата запланованого переходу |
| executionsAmount | number? | Для one-off events |
| packCode | string? | Код пакету для one-off |
| raw | Record<string, unknown> | Оригінальний Stripe payload |

## Response codes (payments-related)

Файл: `packages/types/src/enums/response-code.ts`

| Code | Type | Опис |
|------|------|------|
| `CHECKOUT_SESSION_CREATED` | success | Checkout session створено |
| `PORTAL_SESSION_CREATED` | success | Portal session створено |
| `ALREADY_SUBSCRIBED` | error | Юзер вже має підписку |
| `SUBSCRIPTION_REQUIRED` | error | Потрібна підписка для доступу |
| `NO_BILLING_ACCOUNT` | error | Немає Stripe customer |
| `PAYMENT_TYPE_DISABLED` | error | Тип платежу вимкнений |
