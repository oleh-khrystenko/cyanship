# Phase 2 — Stripe Adapter

## Залежності

Вимагає завершення Phase 1 (оновлені типи).

## Scope

- `apps/api/src/modules/payments/interfaces/payment-provider.interface.ts`
- `apps/api/src/modules/payments/providers/stripe.service.ts`

---

## 2.1 `payment-provider.interface.ts`

**Читай поточний файл перед змінами.**

Оновити `CreateCheckoutInput` — додати `paymentType`, `priceId`, `credits`:

```typescript
import { BillingWebhookEvent, PaymentType } from '@lucidship/types';

export interface CreateCheckoutInput {
    userId: string;
    userEmail: string;
    paymentType: PaymentType;       // NEW: 'subscription' | 'one_off'
    planCode: string;               // для subscription: 'monthly_usd'; для one-off: packCode ('credits_5')
    priceId: string;                // NEW: вже resolved Stripe price ID (передає PaymentsService)
    credits?: number;               // NEW: кількість кредитів (тільки для one-off, включається в metadata)
    successUrl: string;
    cancelUrl: string;
}
```

Решта інтерфейсу (`CheckoutResult`, `PortalResult`, `IPaymentProvider`, `PAYMENT_PROVIDER`) — **без змін**.

---

## 2.2 `providers/stripe.service.ts`

**Читай поточний файл перед змінами (158 рядків).**

### Зміни:

#### 2.2.1 Import оновлення

Додати `BILLING_EVENT_TYPE` `ONE_OFF_PAYMENT_COMPLETED` та `PAYMENT_TYPE` у destructure:

```typescript
import {
    BillingWebhookEvent,
    BILLING_EVENT_TYPE,
    PAYMENT_TYPE,
    SUBSCRIPTION_STATUS,
    type SubscriptionStatus,
} from '@lucidship/types';
```

#### 2.2.2 `createCheckoutSession` — mode + priceId з input

Поточний код жорстко прописує `mode: 'subscription'` та `price: ENV.STRIPE_PRICE_MONTHLY_USD`. Замінити:

```typescript
async createCheckoutSession(
    input: CreateCheckoutInput,
): Promise<CheckoutResult> {
    const mode =
        input.paymentType === PAYMENT_TYPE.ONE_OFF ? 'payment' : 'subscription';

    const session = await this.stripe.checkout.sessions.create({
        mode,
        customer_email: input.userEmail,
        line_items: [{ price: input.priceId, quantity: 1 }],
        metadata: {
            userId: input.userId,
            planCode: input.planCode,
            credits: String(input.credits ?? 0),  // для one-off: кількість кредитів
        },
        client_reference_id: input.userId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
    });

    if (!session.url) {
        throw new Error('Stripe checkout session created without URL');
    }

    return {
        checkoutUrl: session.url,
        providerSessionId: session.id,
    };
}
```

**Важливо:** `priceId` береться з `input.priceId` — більше не `ENV.STRIPE_PRICE_MONTHLY_USD` напряму. Логіка вибору priceId живе в `PaymentsService`.

#### 2.2.3 `handleCheckoutCompleted` — розрізнення subscription vs one-off

Поточний метод завжди повертає `BILLING_EVENT_TYPE.CHECKOUT_COMPLETED`. Замінити на перевірку `session.mode`:

```typescript
private handleCheckoutCompleted(
    event: Stripe.Event,
): BillingWebhookEvent {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId =
        session.metadata?.userId || session.client_reference_id || '';

    // One-off payment (mode=payment, paid)
    if (
        session.mode === 'payment' &&
        session.payment_status === 'paid'
    ) {
        const credits = parseInt(session.metadata?.credits ?? '0', 10);
        return {
            type: BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED,
            providerEventId: event.id,
            occurredAt: new Date(event.created * 1000),
            userId,
            creditsAmount: credits,
            raw: this.toRaw(event.data.object),
        };
    }

    // Subscription checkout (mode=subscription)
    return {
        type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
        providerEventId: event.id,
        occurredAt: new Date(event.created * 1000),
        userId,
        subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        raw: this.toRaw(event.data.object),
    };
}
```

#### 2.2.4 Решта методів

`createPortalSession`, `handleSubscriptionEvent`, `mapSubscriptionStatus`, `toRaw` — **без змін**.

---

## TypeScript notes

- `session.mode` у Stripe SDK типах — `'payment' | 'setup' | 'subscription' | null`
- `session.payment_status` — `'paid' | 'unpaid' | 'no_payment_required' | null`
- Обидва поля nullable — перевірка `session.mode === 'payment' && session.payment_status === 'paid'` достатня

---

## Verification Phase 2

```bash
pnpm --filter api build
# Перевірити що TypeScript не скаржиться на CreateCheckoutInput зміни
```

Перевірити вручну:
- `StripeService` більше не імпортує `ENV.STRIPE_PRICE_MONTHLY_USD` напряму
- `createCheckoutSession` використовує `input.priceId` і `input.paymentType`
- `handleCheckoutCompleted` повертає `ONE_OFF_PAYMENT_COMPLETED` для `mode === 'payment'`
