import { z } from 'zod';

// --- Enums ---

export const PAYMENT_TYPE = {
    SUBSCRIPTION: 'subscription',
    ONE_OFF: 'one_off',
} as const;

export type PaymentType = (typeof PAYMENT_TYPE)[keyof typeof PAYMENT_TYPE];

// --- Product Catalog (single source of truth) ---

export const SUBSCRIPTION_PLANS = [
    { code: 'starter', priceAmount: 500, currency: 'usd', interval: 'month' },
    { code: 'pro', priceAmount: 900, currency: 'usd', interval: 'month' },
] as const;

export type SubscriptionPlanCode = (typeof SUBSCRIPTION_PLANS)[number]['code'];

export const SUBSCRIPTION_PLAN_MAP = Object.fromEntries(
    SUBSCRIPTION_PLANS.map((p) => [p.code, p])
) as { [K in SubscriptionPlanCode]: Extract<(typeof SUBSCRIPTION_PLANS)[number], { code: K }> };

export const CREDIT_PACKS = [
    { code: 'basic', credits: 5, priceAmount: 500, currency: 'usd' },
    { code: 'max', credits: 20, priceAmount: 1500, currency: 'usd' },
] as const;

export type CreditPackCode = (typeof CREDIT_PACKS)[number]['code'];

export const CREDIT_PACK_MAP = Object.fromEntries(
    CREDIT_PACKS.map((p) => [p.code, p])
) as { [K in CreditPackCode]: Extract<(typeof CREDIT_PACKS)[number], { code: K }> };

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
    ONE_OFF_PAYMENT_COMPLETED: 'ONE_OFF_PAYMENT_COMPLETED',
} as const;

export type BillingEventType =
    (typeof BILLING_EVENT_TYPE)[keyof typeof BILLING_EVENT_TYPE];

// --- Schemas ---

export const CreateCheckoutSessionSchema = z
    .object({
        paymentType: z.enum([PAYMENT_TYPE.SUBSCRIPTION, PAYMENT_TYPE.ONE_OFF]),
        planCode: z
            .enum(
                SUBSCRIPTION_PLANS.map((p) => p.code) as [
                    SubscriptionPlanCode,
                    ...SubscriptionPlanCode[],
                ]
            )
            .optional(),
        packCode: z
            .enum(
                CREDIT_PACKS.map((p) => p.code) as [
                    CreditPackCode,
                    ...CreditPackCode[],
                ]
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
        }
    );

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
    packCode: z.string().optional(),
    raw: z.record(z.string(), z.unknown()),
});

export type BillingWebhookEvent = z.infer<typeof BillingWebhookEventSchema>;
