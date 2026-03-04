# Phase 1 — Types & Environment

## Залежності

Нічого не залежить від цієї фази. Починати тут.

## Scope

- `packages/types/src/contracts/payments.ts` — оновити схеми та enum'и
- `packages/types/src/enums/response-code.ts` — новий response code
- `packages/types/src/index.ts` — перевірити re-exports (нічого не треба додавати — `contracts/payments` вже re-exported)
- `apps/api/src/config/env.ts` — нові env vars
- `.env.example` — документування нових змінних

---

## 1.1 `packages/types/src/contracts/payments.ts`

**Повна нова версія файлу.** Читай поточний файл перед змінами.

### Зміни:

1. **Додати `PAYMENT_TYPE` enum** (перед `SUBSCRIPTION_STATUS`):
```typescript
export const PAYMENT_TYPE = {
    SUBSCRIPTION: 'subscription',
    ONE_OFF: 'one_off',
} as const;

export type PaymentType = (typeof PAYMENT_TYPE)[keyof typeof PAYMENT_TYPE];
```

2. **Додати `CREDIT_PACK_CONFIG` constant** (після `PAYMENT_TYPE`):
```typescript
// Конфігурація кредитних пакетів для one-off платежів.
// Key = packCode, value = кількість кредитів.
// priceId для кожного пакету береться з env: STRIPE_PRICE_CREDITS_{N}_USD
export const CREDIT_PACK_CONFIG = {
    credits_5: { credits: 5 },
    credits_10: { credits: 10 },
    credits_20: { credits: 20 },
} as const;

export type CreditPackCode = keyof typeof CREDIT_PACK_CONFIG;
```

3. **Оновити `BILLING_EVENT_TYPE`** — додати `ONE_OFF_PAYMENT_COMPLETED`:
```typescript
export const BILLING_EVENT_TYPE = {
    CHECKOUT_COMPLETED: 'CHECKOUT_COMPLETED',
    SUBSCRIPTION_UPDATED: 'SUBSCRIPTION_UPDATED',
    SUBSCRIPTION_DELETED: 'SUBSCRIPTION_DELETED',
    ONE_OFF_PAYMENT_COMPLETED: 'ONE_OFF_PAYMENT_COMPLETED',  // NEW
} as const;
```

4. **Оновити `CreateCheckoutSessionSchema`** — додати `paymentType` та `packCode`:
```typescript
export const CreateCheckoutSessionSchema = z
    .object({
        paymentType: z.enum([PAYMENT_TYPE.SUBSCRIPTION, PAYMENT_TYPE.ONE_OFF]),
        // Для subscription: planCode обов'язковий (наприклад, 'monthly_usd')
        planCode: z.string().min(1).optional(),
        // Для one-off: packCode обов'язковий (наприклад, 'credits_5')
        packCode: z
            .enum(
                Object.keys(CREDIT_PACK_CONFIG) as [
                    CreditPackCode,
                    ...CreditPackCode[],
                ],
            )
            .optional(),
    })
    .refine(
        (data) =>
            data.paymentType === PAYMENT_TYPE.SUBSCRIPTION
                ? !!data.planCode
                : !!data.packCode,
        {
            message:
                'planCode required for subscription, packCode required for one_off',
        },
    );

export type CreateCheckoutSession = z.infer<typeof CreateCheckoutSessionSchema>;
```

5. **Оновити `BillingWebhookEventSchema`** — зробити subscription-поля nullable/optional, додати one-off поля:
```typescript
export const BillingWebhookEventSchema = z.object({
    type: z.enum([
        BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
        BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
        BILLING_EVENT_TYPE.SUBSCRIPTION_DELETED,
        BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED,
    ]),
    providerEventId: z.string(),
    occurredAt: z.coerce.date(),
    userId: z.string(),
    // --- Subscription fields (присутні тільки для subscription events) ---
    subscriptionStatus: z
        .enum([
            SUBSCRIPTION_STATUS.ACTIVE,
            SUBSCRIPTION_STATUS.TRIALING,
            SUBSCRIPTION_STATUS.PAST_DUE,
            SUBSCRIPTION_STATUS.CANCELED,
            SUBSCRIPTION_STATUS.INCOMPLETE,
            SUBSCRIPTION_STATUS.UNPAID,
            SUBSCRIPTION_STATUS.UNKNOWN,
        ])
        .nullable()
        .optional(),
    currentPeriodEnd: z.coerce.date().nullable().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    // --- One-off fields (присутні тільки для ONE_OFF_PAYMENT_COMPLETED) ---
    creditsAmount: z.number().int().positive().optional(),
    raw: z.record(z.string(), z.unknown()),
});

export type BillingWebhookEvent = z.infer<typeof BillingWebhookEventSchema>;
```

### Результат файлу після змін:

Порядок секцій у файлі:
1. imports
2. `PAYMENT_TYPE` + `PaymentType`
3. `CREDIT_PACK_CONFIG` + `CreditPackCode`
4. `SUBSCRIPTION_STATUS` + `SubscriptionStatus`
5. `BILLING_EVENT_TYPE` + `BillingEventType`
6. `CreateCheckoutSessionSchema` + type
7. `UserBillingSchema` + type (без змін)
8. `BillingWebhookEventSchema` + type

---

## 1.2 `packages/types/src/enums/response-code.ts`

Додати новий код **`PAYMENT_TYPE_DISABLED`** в секцію payments errors:

```typescript
// payments errors
ALREADY_SUBSCRIBED: 'ALREADY_SUBSCRIBED',
SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
NO_BILLING_ACCOUNT: 'NO_BILLING_ACCOUNT',
PAYMENT_TYPE_DISABLED: 'PAYMENT_TYPE_DISABLED',   // NEW
```

Також додати його в `RESPONSE_CODE_TYPE`:
```typescript
[RESPONSE_CODE.PAYMENT_TYPE_DISABLED]: RESPONSE_TYPE.ERROR,
```

---

## 1.3 `apps/api/src/config/env.ts`

**Читай поточний файл перед змінами.**

### Зміни:

1. **Після `STRIPE_PRICE_MONTHLY_USD`** додати credit pack price IDs. Вони required тільки якщо `PAYMENTS_ONE_OFF_ENABLED=true`, але для простоти робимо їх required з failfast (якщо хтось увімкнув one-off без price IDs — краще одразу падати):

```typescript
// --- STRIPE Credit Pack Prices ---
// Required if PAYMENTS_ONE_OFF_ENABLED=true
// Create as one-time prices in Stripe Dashboard (mode: Payment, not Subscription)
STRIPE_PRICE_CREDITS_5_USD: getEnvVar('STRIPE_PRICE_CREDITS_5_USD'),
STRIPE_PRICE_CREDITS_10_USD: getEnvVar('STRIPE_PRICE_CREDITS_10_USD'),
STRIPE_PRICE_CREDITS_20_USD: getEnvVar('STRIPE_PRICE_CREDITS_20_USD'),
```

2. **Після billing URLs** додати feature flags:

```typescript
// --- PAYMENT TYPE TOGGLES ---
// Set to 'false' to disable a payment type entirely.
// At least one must be 'true'.
PAYMENTS_SUBSCRIPTION_ENABLED:
    getEnvVar('PAYMENTS_SUBSCRIPTION_ENABLED', 'true') === 'true',
PAYMENTS_ONE_OFF_ENABLED:
    getEnvVar('PAYMENTS_ONE_OFF_ENABLED', 'true') === 'true',
```

3. **Після `ENV` object definition** додати startup validation:

```typescript
// Validate payment toggles
if (!ENV.PAYMENTS_SUBSCRIPTION_ENABLED && !ENV.PAYMENTS_ONE_OFF_ENABLED) {
    throw new Error(
        '❌ At least one payment type must be enabled. ' +
        'Set PAYMENTS_SUBSCRIPTION_ENABLED or PAYMENTS_ONE_OFF_ENABLED to "true".'
    );
}
```

4. **Після `ENV` object** додати computed helper `STRIPE_CREDIT_PACKS`:

```typescript
// Computed: maps packCode → { priceId, credits }
// Used in PaymentsService to resolve priceId for one-off checkouts.
export const STRIPE_CREDIT_PACKS: Record<
    string,
    { priceId: string; credits: number }
> = {
    credits_5: {
        priceId: ENV.STRIPE_PRICE_CREDITS_5_USD,
        credits: 5,
    },
    credits_10: {
        priceId: ENV.STRIPE_PRICE_CREDITS_10_USD,
        credits: 10,
    },
    credits_20: {
        priceId: ENV.STRIPE_PRICE_CREDITS_20_USD,
        credits: 20,
    },
};
```

---

## 1.4 `.env.example`

Знайди секцію Stripe і додай нові змінні:

```bash
# Stripe — Credit Pack Prices (one-off payments)
# Create as one-time payment prices (not recurring) in Stripe Dashboard
STRIPE_PRICE_CREDITS_5_USD=price_xxx
STRIPE_PRICE_CREDITS_10_USD=price_xxx
STRIPE_PRICE_CREDITS_20_USD=price_xxx

# Payment type toggles (optional, default: true)
# Set to 'false' to disable a specific payment type
PAYMENTS_SUBSCRIPTION_ENABLED=true
PAYMENTS_ONE_OFF_ENABLED=true
```

---

## Verification Phase 1

```bash
pnpm --filter @lucidkit/types build
# Має компілюватись без помилок

pnpm --filter api build
# Має впасти якщо STRIPE_PRICE_CREDITS_5_USD не задано — це очікувано
# (додамо в .env перед тестуванням)
```

TypeScript перевірка:
- `CREDIT_PACK_CONFIG` — правильна структура
- `CreateCheckoutSessionSchema` — `.refine()` перевіряє що або `planCode` або `packCode` задано
- `BillingWebhookEventSchema` — `subscriptionStatus` тепер `nullable().optional()`
