# API Endpoints

Файл: `apps/api/src/modules/payments/payments.controller.ts`

Prefix: `/api/payments`

| Method | Path | Guard | Опис |
|--------|------|-------|------|
| GET | `/api/payments/catalog` | — (`@SkipThrottle`, `@SkipOnboarding`) | Публічний каталог планів і пакетів (зі Stripe, кешований) |
| POST | `/api/payments/checkout-session` | JwtActiveGuard | Створення Stripe Checkout session (subscription або one-off) |
| POST | `/api/payments/portal-session` | JwtActiveGuard | Створення Stripe Billing Portal session |
| POST | `/api/payments/reset` | JwtActiveGuard | Скидання billing (видалення Stripe customer) |
| POST | `/api/payments/webhook/:provider` | SkipThrottle | Прийом webhook-ів від Stripe |

## GET /api/payments/catalog

Без авторизації. Віддає каталог з кешу `CatalogService` ([13-catalog.md](./13-catalog.md)), застосовуючи feature flags: вимкнений тип оплати повертається порожнім масивом.

**Response:** `{ data: { subscriptionPlans: SubscriptionPlanItem[], executionPacks: ExecutionPackItem[] } }`

## POST /api/payments/checkout-session

**Request body:**

```typescript
// Subscription
{ paymentType: 'subscription', planCode: 'starter' | 'pro', returnPath?: '/…' }

// One-off
{ paymentType: 'one_off', packCode: 'basic' | 'max', returnPath?: '/…' }
```

**Валідація:** `CreateCheckoutSessionSchema` (Zod) — `planCode` обов'язковий для subscription, `packCode` обов'язковий для one_off, `returnPath` (якщо є) мусить починатися з `/` і бути не довшим за 256 символів. Самі коди перевіряє не схема, а `CatalogService`.

**Response:** `{ data: { checkoutUrl: string } }`

**Помилки:**
- 400 `PAYMENT_TYPE_DISABLED` — тип платежу вимкнений через feature flag
- 409 `ALREADY_SUBSCRIBED` — юзер вже має активну підписку (тільки для subscription)
- 400 `Invalid planCode` / `Invalid packCode` — коду немає в каталозі Stripe

## POST /api/payments/portal-session

**Request body:** порожній (userId з JWT)

**Response:** `{ data: { portalUrl: string } }`

**Помилки:**
- 400 `NO_BILLING_ACCOUNT` — юзер не має `billing.providerCustomerId`

## POST /api/payments/reset

Dev/demo-операція: обнуляє billing юзера. Записує debit-транзакцію на залишок балансу (`BILLING_RESET`), потім скидає `billing` у `null` і баланс executions у `0`, видаляє оброблені webhook-події і транзакції юзера, і наприкінці видаляє Stripe customer. Якщо видалення у Stripe впало — запис іде в чергу `OrphanedProviderCustomer` на повтор кроном, а сам запит завершується успішно.

Порядок навмисний: спершу БД, потім Stripe. Webhook-и, що прилетять під час скидання, побачать `billing = null` і будуть відкинуті як orphan events.

**Response:** `{ data: null }`, HTTP 200

## POST /api/payments/webhook/:provider

**Підтримувані providers:** `stripe`

**Headers:** `stripe-signature` (обов'язковий)

**Body:** Raw body (Buffer) — потребує `rawBody: true` в `NestFactory.create()`

**Response:** `{ received: true }` (завжди 200 для успішно розпарсених events)

**Помилки:**
- 400 — unsupported provider, missing signature, missing raw body
- Stripe signature verification error — propagates як exception
