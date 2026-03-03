# Phase 1 — Foundation

> Промпт для AI-агента. Перед початком прочитай:
> - `docs/planning/payments-mvp-implementation-blueprint.md` — специфікація
> - `docs/conventions/tone.md`, `docs/conventions/fail-fast.md`, `docs/conventions/i18n.md`
> - `packages/types/src/index.ts` — поточні re-exports
> - `packages/types/src/entities/user.ts` — UserSchema
> - `packages/types/src/enums/response-code.ts` — RESPONSE_CODE
> - `apps/api/src/config/env.ts` — ENV object
> - `apps/api/src/modules/users/schemas/user.schema.ts` — Mongoose User schema

## Мета

Створити типи, контракти, env vars та DB schemas для payments підсистеми. Після цієї фази `packages/types` має нові Zod schemas, API config готовий до Stripe, а User schema має `billing` subdocument.

## Constraints

1. **Zod = single source of truth.** Всі типи через `z.infer`, схеми в `packages/types`.
2. **Fail-fast policy.** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ONE_OFF_USD` — required, crash if missing. `BILLING_SUCCESS_URL`, `BILLING_CANCEL_URL` — optional з defaults.
3. **RESPONSE_CODE pattern.** Нові коди додаються в `RESPONSE_CODE` + `RESPONSE_CODE_TYPE` mapping.
4. **Mongoose `!` operator.** Всі `@Prop()` поля мають `!` (definite assignment).
5. **Не додавати `paths` до API tsconfig.** Packages/types резолвиться через workspace symlink.

## Крок 1: `packages/types/src/contracts/payments.ts`

**Файл:** `packages/types/src/contracts/payments.ts` — **NEW**

Створити:

```typescript
import { z } from 'zod/v4';

// --- Enums ---

export const SUBSCRIPTION_STATUS = {
    ACTIVE: 'ACTIVE',
    TRIALING: 'TRIALING',
    PAST_DUE: 'PAST_DUE',
    CANCELED: 'CANCELED',
    INCOMPLETE: 'INCOMPLETE',
    UNPAID: 'UNPAID',
    UNKNOWN: 'UNKNOWN',
} as const;

export type SubscriptionStatus =
    (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export const BILLING_EVENT_TYPE = {
    CHECKOUT_COMPLETED: 'CHECKOUT_COMPLETED',
    SUBSCRIPTION_UPDATED: 'SUBSCRIPTION_UPDATED',
    SUBSCRIPTION_DELETED: 'SUBSCRIPTION_DELETED',
} as const;

export type BillingEventType =
    (typeof BILLING_EVENT_TYPE)[keyof typeof BILLING_EVENT_TYPE];

// --- Schemas ---

export const CreateCheckoutSessionSchema = z.object({
    planCode: z.string().min(1),
});

export type CreateCheckoutSession = z.infer<typeof CreateCheckoutSessionSchema>;

export const UserBillingSchema = z.object({
    provider: z.string().nullable(),
    providerCustomerId: z.string().nullable(),
    providerSubscriptionId: z.string().nullable(),
    planCode: z.string().nullable(),
    currency: z.string().nullable(),
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
        .nullable(),
    providerSubscriptionStatus: z.string().nullable(),
    currentPeriodEnd: z.coerce.date().nullable(),
    cancelAtPeriodEnd: z.boolean(),
    hasActiveSubscription: z.boolean(),
    lastProviderEventAt: z.coerce.date().nullable(),
});

export type UserBilling = z.infer<typeof UserBillingSchema>;

export const BillingWebhookEventSchema = z.object({
    type: z.enum([
        BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
        BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
        BILLING_EVENT_TYPE.SUBSCRIPTION_DELETED,
    ]),
    providerEventId: z.string(),
    occurredAt: z.coerce.date(),
    userId: z.string(),
    subscriptionStatus: z.enum([
        SUBSCRIPTION_STATUS.ACTIVE,
        SUBSCRIPTION_STATUS.TRIALING,
        SUBSCRIPTION_STATUS.PAST_DUE,
        SUBSCRIPTION_STATUS.CANCELED,
        SUBSCRIPTION_STATUS.INCOMPLETE,
        SUBSCRIPTION_STATUS.UNPAID,
        SUBSCRIPTION_STATUS.UNKNOWN,
    ]),
    currentPeriodEnd: z.coerce.date().nullable(),
    cancelAtPeriodEnd: z.boolean(),
    raw: z.record(z.unknown()),
});

export type BillingWebhookEvent = z.infer<typeof BillingWebhookEventSchema>;
```

> **Примітка:** `UserBillingSchema` використовується і в `packages/types` (Zod validation), і як reference для Mongoose schema (Phase 1, Крок 4). Поля nullable — billing state відсутній до першої підписки.

## Крок 2: `packages/types/src/entities/user.ts`

**Файл:** `packages/types/src/entities/user.ts` — **EDIT**

Додати імпорт та поле `billing` в `UserSchema`:

```typescript
import { UserBillingSchema } from '../contracts/payments';

// Додати до UserSchema:
billing: UserBillingSchema.nullable().optional(),
```

> **Примітка:** `nullable().optional()` — billing може бути `null` або відсутній у юзерів, що ніколи не мали підписки.

## Крок 3: `packages/types/src/enums/response-code.ts`

**Файл:** `packages/types/src/enums/response-code.ts` — **EDIT**

Додати в `RESPONSE_CODE`:

```typescript
// Payments — success
CHECKOUT_SESSION_CREATED: 'CHECKOUT_SESSION_CREATED',
PORTAL_SESSION_CREATED: 'PORTAL_SESSION_CREATED',
WEBHOOK_PROCESSED: 'WEBHOOK_PROCESSED',

// Payments — error
ALREADY_SUBSCRIBED: 'ALREADY_SUBSCRIBED',
SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
NO_BILLING_ACCOUNT: 'NO_BILLING_ACCOUNT',
```

Додати в `RESPONSE_CODE_TYPE` mapping:

```typescript
[RESPONSE_CODE.CHECKOUT_SESSION_CREATED]: RESPONSE_TYPE.SUCCESS,
[RESPONSE_CODE.PORTAL_SESSION_CREATED]: RESPONSE_TYPE.SUCCESS,
[RESPONSE_CODE.WEBHOOK_PROCESSED]: RESPONSE_TYPE.SUCCESS,
[RESPONSE_CODE.ALREADY_SUBSCRIBED]: RESPONSE_TYPE.ERROR,
[RESPONSE_CODE.SUBSCRIPTION_REQUIRED]: RESPONSE_TYPE.ERROR,
[RESPONSE_CODE.NO_BILLING_ACCOUNT]: RESPONSE_TYPE.ERROR,
```

## Крок 4: `packages/types/src/index.ts`

**Файл:** `packages/types/src/index.ts` — **EDIT**

Додати:

```typescript
export * from './contracts/payments';
```

## Крок 5: `apps/api/src/config/env.ts`

**Файл:** `apps/api/src/config/env.ts` — **EDIT**

Додати в ENV object:

```typescript
// Stripe — required (fail-fast)
STRIPE_SECRET_KEY: getEnvVar('STRIPE_SECRET_KEY'),
STRIPE_WEBHOOK_SECRET: getEnvVar('STRIPE_WEBHOOK_SECRET'),
STRIPE_PRICE_ONE_OFF_USD: getEnvVar('STRIPE_PRICE_ONE_OFF_USD'),

// Billing URLs — optional (мають defaults)
BILLING_SUCCESS_URL: getEnvVar('BILLING_SUCCESS_URL', `${getEnvVar('WEB_URL', 'http://localhost:3000')}/billing/success`),
BILLING_CANCEL_URL: getEnvVar('BILLING_CANCEL_URL', `${getEnvVar('WEB_URL', 'http://localhost:3000')}/billing/cancel`),
```

> **Fail-fast:** Stripe keys MUST crash без fallback. Billing URLs мають розумні defaults.

## Крок 6: User schema — billing subdocument

**Файл:** `apps/api/src/modules/users/schemas/user.schema.ts` — **EDIT**

Додати embedded subdocument `billing`:

```typescript
@Prop({
    type: {
        provider: { type: String, default: null },
        providerCustomerId: { type: String, default: null },
        providerSubscriptionId: { type: String, default: null },
        planCode: { type: String, default: null },
        currency: { type: String, default: null },
        subscriptionStatus: { type: String, default: null },
        providerSubscriptionStatus: { type: String, default: null },
        currentPeriodEnd: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
        hasActiveSubscription: { type: Boolean, default: false },
        lastProviderEventAt: { type: Date, default: null },
    },
    default: null,
    _id: false,
})
billing!: {
    provider: string | null;
    providerCustomerId: string | null;
    providerSubscriptionId: string | null;
    planCode: string | null;
    currency: string | null;
    subscriptionStatus: string | null;
    providerSubscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    hasActiveSubscription: boolean;
    lastProviderEventAt: Date | null;
} | null;
```

Додати індекси (в `@Schema` decorator options або через `SchemaFactory`):

```typescript
// Після створення schema:
UserSchema.index({ 'billing.providerCustomerId': 1 }, { sparse: true });
UserSchema.index({ 'billing.providerSubscriptionId': 1 }, { sparse: true });
```

> **Примітка:** `sparse: true` — індекс не включає документи де поле null (більшість юзерів не мають billing).

## Крок 7: ProcessedWebhookEvent schema

**Файл:** `apps/api/src/modules/payments/schemas/processed-webhook-event.schema.ts` — **NEW**

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProcessedWebhookEventDocument =
    HydratedDocument<ProcessedWebhookEvent>;

@Schema({ timestamps: false })
export class ProcessedWebhookEvent {
    @Prop({ required: true })
    provider!: string;

    @Prop({ required: true })
    providerEventId!: string;

    @Prop({ required: true })
    receivedAt!: Date;

    @Prop({ required: true })
    occurredAt!: Date;

    @Prop({ required: true })
    type!: string;

    @Prop({ default: null })
    userId!: string | null;
}

export const ProcessedWebhookEventSchema =
    SchemaFactory.createForClass(ProcessedWebhookEvent);

ProcessedWebhookEventSchema.index(
    { provider: 1, providerEventId: 1 },
    { unique: true },
);
```

## Крок 8: Install `stripe` package

```bash
pnpm --filter api add stripe
```

## Порядок виконання

```
1. Крок 1 — contracts/payments.ts (NEW)
2. Крок 2 — entities/user.ts (EDIT, залежить від 1)
3. Крок 3 — response-code.ts (EDIT, незалежний)
4. Крок 4 — index.ts (EDIT, залежить від 1)
5. pnpm --filter @lucidkit/types build — перевірити що types збираються
6. Крок 5 — env.ts (EDIT, незалежний)
7. Крок 6 — user.schema.ts (EDIT, незалежний від types build)
8. Крок 7 — processed-webhook-event.schema.ts (NEW, незалежний)
9. Крок 8 — install stripe
10. pnpm --filter api build — перевірити що API збирається
```

## Verification

1. `pnpm --filter @lucidkit/types build` — без помилок
2. `pnpm --filter api build` — без помилок
3. `pnpm lint` — без помилок
4. `pnpm --filter api test` — існуючі тести проходять
5. Перевірити що `UserBillingSchema`, `SUBSCRIPTION_STATUS`, `BILLING_EVENT_TYPE`, `CreateCheckoutSessionSchema`, `BillingWebhookEventSchema` експортуються з `@lucidkit/types`
