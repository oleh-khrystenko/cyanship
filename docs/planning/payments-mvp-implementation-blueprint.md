# Payments MVP Implementation Blueprint

MVP implementation blueprint: `IPaymentProvider` adapter pattern + `StripeService`.

**1) Target Architecture (MVP + Adapter Pattern)**

```
              ┌─────────────────────┐
              │  PaymentsController  │
              │  - checkout-session  │
              │  - portal-session    │
              │  - webhook/:provider │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   PaymentsService   │
              │  (orchestration +   │
              │   billing state)    │
              └──────────┬──────────┘
                         │
          ┌──────────────▼──────────────┐
          │  IPaymentProvider (token)    │
          │  - createCheckoutSession()  │
          │  - createPortalSession()    │
          │  - handleWebhookPayload()   │
          └──────────────┬──────────────┘
                         │
              ┌──────────▼──────────┐
              │    StripeService     │
              │  (implements above)  │
              └─────────────────────┘
```

- `PaymentsController`: HTTP-вхід (checkout + portal + webhook).
- `PaymentsService`: orchestration, бізнес-правила доступу, idempotency, оновлення user billing state. Використовує існуючий skeleton `PaymentsService` — без перейменувань.
- `IPaymentProvider`: єдиний контракт для провайдера. Інжектиться через NestJS DI token (НЕ Registry class).
- `StripeService implements IPaymentProvider`: вся Stripe-специфіка всередині.
- Mongoose schema `ProcessedWebhookEvent`: зберігання processed event IDs для dedup.

> **Чому без `PaymentProviderRegistry`:** NestJS DI — це вже registry. Injection token `PAYMENT_PROVIDER` резолвить на `StripeService`. Коли з'явиться другий провайдер — додається factory provider з логікою вибору. Не потрібен окремий клас для 1 провайдера.

**2) `IPaymentProvider` Contract**

```
createCheckoutSession(input: CreateCheckoutInput) → { checkoutUrl: string; providerSessionId: string }
createPortalSession(providerCustomerId: string) → { portalUrl: string }
handleWebhookPayload(rawBody: Buffer, signatureHeader: string) → BillingWebhookEvent | null
```

- `handleWebhookPayload` об'єднує верифікацію підпису + парсинг + нормалізацію в один метод. Adapter сам вирішує як це зробити. `null` повертається для невідомих/ігнорованих типів подій.
- `createPortalSession` — Stripe Customer Portal для self-service управління підпискою (скасування, оновлення платіжних даних). Без цього юзеру ніде керувати підпискою.

**3) Canonical `BillingWebhookEvent` Model**

```
type: CHECKOUT_COMPLETED | SUBSCRIPTION_UPDATED | SUBSCRIPTION_DELETED | ONE_OFF_PAYMENT_COMPLETED
providerEventId: string
occurredAt: Date              // ВАЖЛИВО: використовувати stripeEvent.created (Unix epoch), НЕ час отримання
userId: string                // з metadata.userId / client_reference_id
subscriptionStatus: canonical status (ACTIVE | TRIALING | PAST_DUE | CANCELED | INCOMPLETE | UNPAID | UNKNOWN)
currentPeriodEnd: Date | null
cancelAtPeriodEnd: boolean
raw: Record<string, unknown>  // оригінальний provider payload для debug/diagnostics
```

> **Спрощення vs попередній варіант:** `providerCustomerId`, `providerSubscriptionId`, `planCode`, `currency` не дублюються в event — вони витягуються з `raw` payload адаптером та зберігаються напряму в `user.billing` під час обробки `CHECKOUT_COMPLETED`. Це зменшує розходження між event та billing state.

**4) API Endpoints (MVP scope)**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/payments/checkout-session` | JWT | Згенерувати Stripe Checkout link для `monthly_usd` |
| POST | `/api/payments/portal-session` | JWT | Згенерувати Stripe Customer Portal link |
| POST | `/api/payments/webhook/:provider` | No (signature) | Прийом webhook-ів, dedup, оновлення billing state |

`POST /api/payments/checkout-session`
- Request: `{ planCode: "monthly_usd" }`
- Response: `{ data: { checkoutUrl: string } }`
- Rules: якщо у юзера вже `hasActiveSubscription === true`, повертати бізнес-помилку `ALREADY_SUBSCRIBED`.
- В Checkout metadata обов'язково класти `userId` (ключове для webhook mapping).

`POST /api/payments/portal-session`
- Request: (empty body, userId з JWT)
- Response: `{ data: { portalUrl: string } }`
- Rules: якщо у юзера немає `billing.providerCustomerId`, повертати бізнес-помилку.

`POST /api/payments/webhook/:provider`
- **Raw body:** Потребує `rawBody: true` в NestJS bootstrap options (`NestFactory.create(AppModule, { rawBody: true })`). Stripe SDK вимагає необроблений Buffer для верифікації підпису. Стандартний Express JSON body-parser ламає верифікацію.
- Отримати raw body через `@Req() req` → `req.rawBody`.
- Signature header: `stripe-signature` (для Stripe).
- Для duplicate/unknown events: `200` (без повторної обробки).
- Для invalid signature: `400`.
- Для transient DB errors: `5xx` (щоб Stripe retry).

**5) БД: мінімальні поля**

### `user.billing` (subdocument в User schema)

- `provider` (`"stripe"`)
- `providerCustomerId` (`string | null`)
- `providerSubscriptionId` (`string | null`)
- `planCode` (`"monthly_usd"`)
- `currency` (`"USD"`)
- `subscriptionStatus` (canonical: `ACTIVE | TRIALING | PAST_DUE | CANCELED | INCOMPLETE | UNPAID | UNKNOWN`)
- `providerSubscriptionStatus` (raw Stripe status string)
- `currentPeriodEnd` (`Date | null`)
- `cancelAtPeriodEnd` (`boolean`)
- `hasActiveSubscription` (`boolean`) — denormalized, оновлюється атомарно разом з `subscriptionStatus`
- `lastProviderEventAt` (`Date`) — для out-of-order detection; `occurredAt = stripeEvent.created`

> **Soft-delete note:** При soft-delete User (30-day grace period) billing state зберігається — дозволяє restore акаунту з підпискою. Cancellation через Stripe API виконується окремо якщо потрібно.

### `processed_webhook_events` (окрема колекція)

- `provider` (`string`)
- `providerEventId` (`string`)
- `receivedAt` (`Date`)
- `occurredAt` (`Date`)
- `type` (`string`)
- `userId` (`string`, optional — for diagnostics)

### Індекси

- unique compound: `(provider, providerEventId)` у `processed_webhook_events` (idempotency)
- index: `user.billing.providerSubscriptionId`
- index: `user.billing.providerCustomerId`

**6) Webhook Matrix (MVP)**

| Provider Event (Stripe) | Canonical Type | Дія в PaymentsService | Результат |
|---|---|---|---|
| `checkout.session.completed` | `CHECKOUT_COMPLETED` | Upsert `providerCustomerId`, `providerSubscriptionId`, `planCode`, `currency`, status/period з `raw` payload | Рахуємо `hasActiveSubscription` |
| `customer.subscription.updated` | `SUBSCRIPTION_UPDATED` | Оновити status, raw status, `currentPeriodEnd`, `cancelAtPeriodEnd` | Перерахувати `hasActiveSubscription` |
| `customer.subscription.deleted` | `SUBSCRIPTION_DELETED` | Status → `CANCELED`, `hasActiveSubscription = false` | Доступ вимкнено |
| `checkout.session.completed` (mode=payment, paid) | `ONE_OFF_PAYMENT_COMPLETED` | `addCredits(userId, credits)` з metadata | Кредити нараховано |
| `checkout.session.async_payment_succeeded` (mode=payment) | `ONE_OFF_PAYMENT_COMPLETED` | Те саме (async payment confirmation) | Кредити нараховано |

Правило активності (MVP):
- `hasActiveSubscription = subscriptionStatus in [ACTIVE, TRIALING]`
- Ніякої локальної dunning/tax логіки.

**7) Idempotency + Out-of-order Handling**

1. Вставка `(provider, providerEventId)` в `processed_webhook_events`.
2. Якщо duplicate key → `200`, stop.
3. Якщо `occurredAt <= user.billing.lastProviderEventAt` → ignore, `200`. (`occurredAt` = `stripeEvent.created`, Unix epoch)
4. Apply patch, оновити `lastProviderEventAt`.
5. Log success.

**8) Access Guard**

- `SubscriptionGuard` (або `@RequireSubscription()` decorator) — перевіряє `user.billing.hasActiveSubscription`.
- Використовується на захищених endpoints (reports, AI-аналіз).
- Повертає `403` з кодом `SUBSCRIPTION_REQUIRED`.

**9) `packages/types` — нові контракти та коди**

### `contracts/payments.ts`
- `CreateCheckoutSessionSchema` — `{ planCode: z.string() }`
- `BillingStatusSchema` — canonical billing state для frontend
- `SUBSCRIPTION_STATUS` enum — `ACTIVE | TRIALING | PAST_DUE | CANCELED | INCOMPLETE | UNPAID | UNKNOWN`
- `BILLING_EVENT_TYPE` enum — `CHECKOUT_COMPLETED | SUBSCRIPTION_UPDATED | SUBSCRIPTION_DELETED | ONE_OFF_PAYMENT_COMPLETED`

### `entities/user.ts` — розширення
- `UserBillingSchema` — Zod schema для `user.billing` subdocument

### `enums/response-code.ts` — нові коди
- `CHECKOUT_SESSION_CREATED` (success)
- `PORTAL_SESSION_CREATED` (success)
- `ALREADY_SUBSCRIBED` (error)
- `SUBSCRIPTION_REQUIRED` (error)
- `NO_BILLING_ACCOUNT` (error)
- `WEBHOOK_PROCESSED` (success)

### `messages/uk.json` + `messages/en.json` — i18n ключі
- `notifications.payments.CHECKOUT_SESSION_CREATED`
- `notifications.payments.PORTAL_SESSION_CREATED`
- `notifications.payments.WEBHOOK_PROCESSED`
- `errors.payments.ALREADY_SUBSCRIBED`
- `errors.payments.SUBSCRIPTION_REQUIRED`
- `errors.payments.NO_BILLING_ACCOUNT`

**10) Конфіг (env vars)**

Required (fail-fast, crash if missing):
- `STRIPE_SECRET_KEY` — Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` — Webhook endpoint signing secret
- `STRIPE_PRICE_MONTHLY_USD` — Stripe Price ID для monthly plan

Optional (мають defaults):
- `BILLING_SUCCESS_URL` → `${WEB_URL}/billing/success`
- `BILLING_CANCEL_URL` → `${WEB_URL}/billing/cancel`

> **Прибрано:** `PAYMENT_PROVIDER_ACTIVE` — не потрібен без `PaymentProviderRegistry`. Активний provider визначається через NestJS DI injection token.

**11) Як додасться Monobank без перепису ядра**

1. Реалізується `MonobankService implements IPaymentProvider`.
2. Додається factory provider для injection token `PAYMENT_PROVIDER` з логікою вибору (env var / config).
3. Додається webhook endpoint config/secret.
4. `PaymentsService` і controller contracts **не змінюються** — працюють через interface.
