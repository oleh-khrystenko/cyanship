# Payments MVP Implementation Blueprint

Нижче **MVP implementation blueprint** з урахуванням `IPaymentProvider` + `StripeService`.

**1) Target Architecture (MVP + Adapter Pattern)**
- `PaymentsController`: тільки HTTP-вхід (checkout + webhook).
- `BillingService`: orchestration, бізнес-правила доступу, idempotency, оновлення user billing state.
- `IPaymentProvider`: єдиний контракт для провайдера.
- `StripeService implements IPaymentProvider`: вся Stripe-специфіка всередині.
- `PaymentProviderRegistry`: повертає активний адаптер (`stripe` зараз, `monobank` потім).
- `WebhookEventStore`: зберігання processed event IDs для dedup.

**2) `IPaymentProvider` Contract (без коду, логічно)**
- `createCheckoutSession(input) -> { checkoutUrl, providerSessionId }`
- `verifyAndParseWebhook(rawBody, signatureHeader) -> ProviderWebhookEvent`
- `normalizeWebhookEvent(providerEvent) -> BillingWebhookEvent`  
  (canonical event для `BillingService`, незалежний від Stripe payload shape)

**3) Canonical Event Model для BillingService**
- `provider`: `stripe | ...`
- `providerEventId`
- `occurredAt`
- `type`: `CHECKOUT_COMPLETED | SUBSCRIPTION_UPDATED | SUBSCRIPTION_DELETED`
- `userId` (з metadata/client_reference_id)
- `providerCustomerId`
- `providerSubscriptionId`
- `planCode` (`monthly_usd`)
- `currency` (`USD`)
- `subscriptionStatus` (canonical)
- `providerSubscriptionStatus` (raw)
- `currentPeriodEnd`
- `cancelAtPeriodEnd`

**4) API Endpoints (MVP scope only)**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/payments/checkout-session` | Yes | Згенерувати Stripe Checkout link для `monthly_usd` |
| POST | `/api/payments/webhook/:provider` | No (signature required) | Прийом webhook-ів, dedup, оновлення billing state |

`POST /api/payments/checkout-session`
- Request: `{ planCode: "monthly_usd" }`
- Response: `{ checkoutUrl: string }`
- Rules: якщо у юзера вже active subscription, повертати бізнес-помилку (щоб не плодити сесії без потреби).
- В Checkout metadata обов’язково класти `userId` (ключове для webhook mapping).

`POST /api/payments/webhook/:provider`
- Signature verify робить відповідний adapter (`StripeService`).
- Для duplicate/unknown events: `200` (без повторної обробки).
- Для invalid signature: `400`.
- Для transient DB errors: `5xx` (щоб Stripe retry).

**5) БД: мінімальні поля (в User)**

`user.billing`:
- `provider` (`"stripe"`)
- `providerCustomerId`
- `providerSubscriptionId`
- `planCode` (`"monthly_usd"`)
- `currency` (`"USD"`)
- `subscriptionStatus` (canonical: `ACTIVE | TRIALING | PAST_DUE | CANCELED | INCOMPLETE | UNPAID | UNKNOWN`)
- `providerSubscriptionStatus` (raw Stripe status)
- `currentPeriodEnd` (`Date | null`)
- `cancelAtPeriodEnd` (`boolean`)
- `hasActiveSubscription` (`boolean`)
- `lastProviderEventAt` (`Date`)

Окрема легка колекція `processed_webhook_events`:
- `provider`
- `providerEventId`
- `receivedAt`
- `occurredAt`
- `type`
- `userId` (optional for diagnostics)

Індекси:
- unique: `(provider, providerEventId)` у `processed_webhook_events` (idempotency)
- index: `user.billing.providerSubscriptionId`
- index: `user.billing.providerCustomerId`

**6) Webhook Matrix (MVP)**

| Provider Event (Stripe) | Canonical Type | Дія в BillingService | Результат доступу |
|---|---|---|---|
| `checkout.session.completed` | `CHECKOUT_COMPLETED` | Upsert `providerCustomerId`, `providerSubscriptionId`, `planCode`, `currency`, status/period | Рахуємо `hasActiveSubscription` |
| `customer.subscription.updated` | `SUBSCRIPTION_UPDATED` | Оновити status, raw status, `currentPeriodEnd`, `cancelAtPeriodEnd` | Перерахувати `hasActiveSubscription` |
| `customer.subscription.deleted` | `SUBSCRIPTION_DELETED` | Status -> `CANCELED`, `hasActiveSubscription=false` | Доступ вимкнено |

Правило активності (MVP):
- `hasActiveSubscription = subscriptionStatus in [ACTIVE, TRIALING]`
- Ніякої локальної dunning/tax логіки.

**7) Idempotency + Out-of-order Handling**
- Крок 1: вставка `(provider, providerEventId)` в `processed_webhook_events`.
- Крок 2: якщо duplicate key -> `200`, stop.
- Крок 3: якщо `occurredAt <= user.billing.lastProviderEventAt` -> ignore, `200`.
- Крок 4: apply patch, оновити `lastProviderEventAt`.
- Крок 5: log success.

**8) Конфіг (мінімум)**
- `PAYMENT_PROVIDER_ACTIVE=stripe`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY_USD`
- `BILLING_SUCCESS_URL`
- `BILLING_CANCEL_URL`

**9) Як додасться Monobank без перепису ядра**
- Реалізується `MonobankService implements IPaymentProvider`.
- Реєструється в `PaymentProviderRegistry`.
- Додається webhook endpoint config/secret.
- `BillingService` і controller contracts не змінюються.
