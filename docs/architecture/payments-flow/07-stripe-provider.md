# Stripe Provider

Файл: `apps/api/src/modules/payments/providers/stripe.service.ts`

## StripeService implements IPaymentProvider

Єдина реалізація `IPaymentProvider`. Використовує Stripe SDK v20.4.0 з API version `2026-02-25.clover`.

## IPaymentProvider Interface

Файл: `apps/api/src/modules/payments/interfaces/payment-provider.interface.ts`

```typescript
interface IPaymentProvider {
    createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutResult>;
    createPortalSession(providerCustomerId: string): Promise<PortalResult>;
    handleWebhookPayload(rawBody: Buffer, signatureHeader: string): BillingWebhookEvent | null;
}
```

## CreateCheckoutInput

```typescript
interface CreateCheckoutInput {
    userId: string;
    userEmail: string;
    providerCustomerId?: string;  // reuse existing Stripe customer
    paymentType: PaymentType;
    planCode: string;              // для one-off сюди йде packCode
    priceId: string;
    executions?: number;
    successUrl: string;
    cancelUrl: string;
}
```

## createCheckoutSession

- Mode: `payment` для one-off, `subscription` для subscription
- Customer: використовує існуючий `providerCustomerId` якщо є, інакше `customer_email`
- Metadata: `{ userId, planCode, executions }` — критично для webhook mapping; `executions` пишеться рядком (Stripe metadata приймає лише рядки)
- `client_reference_id: userId` — backup для resolveUserId
- Якщо Stripe повернув session без `url` — кидає помилку, а не віддає порожнє посилання

## createPortalSession

- Створює Stripe Billing Portal session для self-service управління підпискою
- `return_url` приходить аргументом від `PaymentsService` — це `{WEB_URL}/{locale}/billing`, не env var

## handleWebhookPayload

1. `stripe.webhooks.constructEvent(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET)` — верифікація підпису
2. Switch по `event.type`:
   - `checkout.session.completed` / `checkout.session.async_payment_succeeded` → `handleCheckoutCompleted()`
   - `customer.subscription.updated` → `handleSubscriptionEvent(SUBSCRIPTION_UPDATED)`
   - `customer.subscription.deleted` → `handleSubscriptionEvent(SUBSCRIPTION_DELETED)`
   - Інше → `null` (ігнорується, debug log)

## Subscription Status Mapping

```
Stripe status       → Canonical status
active              → ACTIVE
trialing            → TRIALING
past_due            → PAST_DUE
canceled            → CANCELED
incomplete          → INCOMPLETE
unpaid              → UNPAID
incomplete_expired  → CANCELED
paused              → UNKNOWN
(інше)              → UNKNOWN
```

## handleCheckoutCompleted

Розрізняє subscription checkout та one-off payment:

- `session.mode === 'subscription'` → `CHECKOUT_COMPLETED` event з `subscriptionStatus: ACTIVE`
- `session.mode === 'payment' && payment_status === 'paid'` → `ONE_OFF_PAYMENT_COMPLETED` з `executionsAmount` з metadata
- Інші комбінації mode/status → `null` (debug log)

## handleSubscriptionEvent

- Для updated/deleted — читає subscription object з event
- `currentPeriodEnd` — з `subscription.items.data[0].current_period_end`
- `userId` — порожній рядок (буде resolved через resolveUserId по providerSubscriptionId)

## rawBody requirement

`rawBody: true` у `NestFactory.create()` (файл `apps/api/src/main.ts`) — обов'язково для `stripe.webhooks.constructEvent()`. Без цього signature verification failing.
