# Phase 2 — Stripe Adapter

> Залежить від: Phase 1 (Foundation).
> Перед початком прочитай:
> - `docs/planning/payments-mvp-implementation-blueprint.md` — секції 2, 3
> - `packages/types/src/contracts/payments.ts` — створений в Phase 1
> - `apps/api/src/config/env.ts` — Stripe env vars додані в Phase 1
> - `apps/api/src/modules/payments/` — існуючий skeleton

## Мета

Створити `IPaymentProvider` interface та `StripeService` що його реалізує. Налаштувати NestJS DI injection token. Після цієї фази adapter повністю інкапсулює Stripe SDK — жоден інший файл не імпортує `stripe` напряму.

## Constraints

1. **Вся Stripe-специфіка — тільки в `StripeService`.** Ніякі Stripe types, SDK imports, або payload shapes не виходять за межі adapter.
2. **`handleWebhookPayload` повертає `BillingWebhookEvent | null`.** `null` для невідомих/ігнорованих event types.
3. **`occurredAt` = `stripeEvent.created` (Unix epoch → Date).** НЕ час отримання webhook.
4. **NestJS DI token замість Registry class.** Один injection token `PAYMENT_PROVIDER` резолвить на `StripeService`.
5. **Stripe SDK ініціалізується з `ENV.STRIPE_SECRET_KEY`.** Не через constructor injection — через direct import `ENV`.

## Крок 1: IPaymentProvider interface

**Файл:** `apps/api/src/modules/payments/interfaces/payment-provider.interface.ts` — **NEW**

```typescript
import { BillingWebhookEvent } from '@lucidship/types';

export interface CreateCheckoutInput {
    userId: string;
    userEmail: string;
    planCode: string;
    successUrl: string;
    cancelUrl: string;
}

export interface CheckoutResult {
    checkoutUrl: string;
    providerSessionId: string;
}

export interface PortalResult {
    portalUrl: string;
}

export interface IPaymentProvider {
    createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutResult>;
    createPortalSession(providerCustomerId: string): Promise<PortalResult>;
    handleWebhookPayload(
        rawBody: Buffer,
        signatureHeader: string,
    ): BillingWebhookEvent | null;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
```

> **Примітка:** `PAYMENT_PROVIDER` symbol — NestJS injection token. Використовується як `@Inject(PAYMENT_PROVIDER)` в `PaymentsService`.

## Крок 2: StripeService

**Файл:** `apps/api/src/modules/payments/providers/stripe.service.ts` — **NEW**

Реалізувати `IPaymentProvider`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
    BillingWebhookEvent,
    BILLING_EVENT_TYPE,
    SUBSCRIPTION_STATUS,
    type SubscriptionStatus,
} from '@lucidship/types';
import { ENV } from '../../../config/env';
import {
    IPaymentProvider,
    CreateCheckoutInput,
    CheckoutResult,
    PortalResult,
} from '../interfaces/payment-provider.interface';
```

### `constructor`

- Ініціалізувати `Stripe` з `ENV.STRIPE_SECRET_KEY` та `apiVersion` (latest stable).

### `createCheckoutSession(input)`

- Створити `stripe.checkout.sessions.create()`:
  - `mode: 'subscription'`
  - `customer_email: input.userEmail` (якщо немає існуючого customer)
  - `line_items: [{ price: ENV.STRIPE_PRICE_MONTHLY_USD, quantity: 1 }]`
  - `metadata: { userId: input.userId }`
  - `client_reference_id: input.userId`
  - `success_url: input.successUrl`
  - `cancel_url: input.cancelUrl`
- Повернути `{ checkoutUrl: session.url, providerSessionId: session.id }`.
- Якщо `session.url` null — throw.

### `createPortalSession(providerCustomerId)`

- Створити `stripe.billingPortal.sessions.create()`:
  - `customer: providerCustomerId`
  - `return_url: ENV.BILLING_SUCCESS_URL`
- Повернути `{ portalUrl: session.url }`.

### `handleWebhookPayload(rawBody, signatureHeader)`

- `stripe.webhooks.constructEvent(rawBody, signatureHeader, ENV.STRIPE_WEBHOOK_SECRET)` — верифікація підпису. При помилці — throw (controller обробить як 400).
- Маппінг event types:

| `event.type` (Stripe) | Canonical type | Як витягти дані |
|---|---|---|
| `checkout.session.completed` | `CHECKOUT_COMPLETED` | `session = event.data.object`, `userId = session.metadata.userId \|\| session.client_reference_id` |
| `customer.subscription.updated` | `SUBSCRIPTION_UPDATED` | `subscription = event.data.object`, userId шукати через `PaymentsService` по `providerSubscriptionId` |
| `customer.subscription.deleted` | `SUBSCRIPTION_DELETED` | Аналогічно `SUBSCRIPTION_UPDATED` |

- Для невідомих event types — повернути `null`.
- `occurredAt: new Date(event.created * 1000)` — Stripe `created` в Unix seconds.

### Маппінг Stripe status → canonical

```typescript
private mapSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
    const mapping: Record<string, SubscriptionStatus> = {
        active: SUBSCRIPTION_STATUS.ACTIVE,
        trialing: SUBSCRIPTION_STATUS.TRIALING,
        past_due: SUBSCRIPTION_STATUS.PAST_DUE,
        canceled: SUBSCRIPTION_STATUS.CANCELED,
        incomplete: SUBSCRIPTION_STATUS.INCOMPLETE,
        unpaid: SUBSCRIPTION_STATUS.UNPAID,
        incomplete_expired: SUBSCRIPTION_STATUS.CANCELED,
        paused: SUBSCRIPTION_STATUS.UNKNOWN,
    };
    return mapping[stripeStatus] ?? SUBSCRIPTION_STATUS.UNKNOWN;
}
```

> **Важливо щодо `SUBSCRIPTION_UPDATED`/`SUBSCRIPTION_DELETED`:** Ці Stripe events не мають `metadata.userId` (metadata є на checkout session, не на subscription). `userId` потрібно знайти через lookup `user.billing.providerSubscriptionId`. Це робить `PaymentsService`, не adapter. Тому для цих events adapter повинен:
> - Або приймати `userIdResolver` callback
> - Або повертати `userId: null` і дозволити `PaymentsService` резолвити
>
> **Рекомендація:** Повертати `userId: ''` (empty string) для subscription events, а `PaymentsService` буде шукати user по `providerSubscriptionId` з `raw` payload. Це зберігає adapter stateless.

## Крок 3: DI Provider

**Файл:** `apps/api/src/modules/payments/providers/payment-provider.provider.ts` — **NEW**

```typescript
import { Provider } from '@nestjs/common';
import { PAYMENT_PROVIDER } from '../interfaces/payment-provider.interface';
import { StripeService } from './stripe.service';

export const paymentProviderProvider: Provider = {
    provide: PAYMENT_PROVIDER,
    useClass: StripeService,
};
```

> **Розширення:** Коли додається другий провайдер — `useClass` замінюється на `useFactory` з логікою вибору. Жоден інший файл не змінюється.

## Порядок виконання

```
1. Крок 1 — interface + token (NEW)
2. Крок 2 — StripeService (NEW, залежить від 1)
3. Крок 3 — DI provider (NEW, залежить від 1 + 2)
4. pnpm --filter api build — перевірити компіляцію
```

> **Примітка:** НЕ підключати в `payments.module.ts` ще — це робить Phase 3.

## Verification

1. `pnpm --filter api build` — компілюється без помилок
2. `pnpm lint` — без помилок
3. `StripeService` не має жодного public методу що повертає Stripe-specific types
4. `PAYMENT_PROVIDER` token експортується з interface файлу
5. Жоден файл поза `providers/stripe.service.ts` не імпортує `stripe` SDK
