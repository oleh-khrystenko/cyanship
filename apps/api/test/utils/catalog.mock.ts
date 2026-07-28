import type { PaymentsCatalog } from '@cyanship/types';

/**
 * Deterministic stand-in for the Stripe-backed catalog.
 *
 * `CatalogService.onModuleInit()` performs a real Stripe fetch and fails fast if
 * it cannot reach the API — every e2e fixture that boots `PaymentsModule` must
 * therefore override the service, not just its Redis cache.
 *
 * Price ids are stable so webhook fixtures can reference them directly.
 */
export const TEST_CATALOG: PaymentsCatalog = {
    subscriptionPlans: [
        {
            code: 'starter',
            priceId: 'price_test_starter',
            priceAmount: 4900,
            currency: 'usd',
            interval: 'month',
            executions: 10000,
            displayOrder: 1,
            featured: false,
        },
        {
            code: 'pro',
            priceId: 'price_test_pro',
            priceAmount: 14900,
            currency: 'usd',
            interval: 'month',
            executions: 50000,
            displayOrder: 2,
            featured: true,
        },
    ],
    executionPacks: [
        {
            code: 'basic',
            priceId: 'price_test_basic',
            priceAmount: 2900,
            currency: 'usd',
            executions: 5000,
            displayOrder: 1,
            featured: false,
        },
        {
            code: 'max',
            priceId: 'price_test_max',
            priceAmount: 9900,
            currency: 'usd',
            executions: 25000,
            displayOrder: 2,
            featured: true,
        },
    ],
};

const PRICE_TO_PLAN = Object.fromEntries(
    TEST_CATALOG.subscriptionPlans.map((plan) => [plan.priceId, plan.code])
);

// Subscription plans only — mirrors CatalogService.getPriceToExecutionsMap(),
// which feeds plan-change proration and never looks at one-off pack prices.
// A wider map here would let a lookup pass in tests and return undefined in prod.
const PRICE_TO_EXECUTIONS = Object.fromEntries(
    TEST_CATALOG.subscriptionPlans.map((plan) => [
        plan.priceId,
        plan.executions,
    ])
);

/** Full mock of the `CatalogService` public surface used by PaymentsService. */
export function createCatalogServiceMock() {
    return {
        onModuleInit: jest.fn().mockResolvedValue(undefined),
        getCatalog: jest.fn().mockResolvedValue(TEST_CATALOG),
        refreshCatalog: jest.fn().mockResolvedValue(TEST_CATALOG),
        getSubscriptionPlan: jest.fn((code: string) =>
            Promise.resolve(
                TEST_CATALOG.subscriptionPlans.find((p) => p.code === code)
            )
        ),
        getExecutionPack: jest.fn((code: string) =>
            Promise.resolve(
                TEST_CATALOG.executionPacks.find((p) => p.code === code)
            )
        ),
        getPriceToPlanMap: jest.fn().mockResolvedValue(PRICE_TO_PLAN),
        getPriceToExecutionsMap: jest
            .fn()
            .mockResolvedValue(PRICE_TO_EXECUTIONS),
    };
}
