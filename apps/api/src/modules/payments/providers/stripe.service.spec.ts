jest.mock('stripe');
jest.mock('../../../config/env', () => ({
    ENV: {
        STRIPE_SECRET_KEY: 'sk_test_xxx',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
        STRIPE_PRICE_MONTHLY_USD: 'price_test_monthly',
        BILLING_SUCCESS_URL: 'http://localhost:3000/billing/success',
        BILLING_CANCEL_URL: 'http://localhost:3000/billing/cancel',
    },
}));

import Stripe from 'stripe';
import { Test, TestingModule } from '@nestjs/testing';
import { BILLING_EVENT_TYPE, SUBSCRIPTION_STATUS } from '@lucidkit/types';

import { StripeService } from './stripe.service';

// ─── Mock instances shared across tests ─────────────────────────────────────

const mockCheckoutCreate = jest.fn();
const mockPortalCreate = jest.fn();
const mockConstructEvent = jest.fn();

const mockStripeInstance = {
    checkout: { sessions: { create: mockCheckoutCreate } },
    billingPortal: { sessions: { create: mockPortalCreate } },
    webhooks: { constructEvent: mockConstructEvent },
};

(Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(
    () => mockStripeInstance as unknown as Stripe,
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeCheckoutEvent = (overrides: Record<string, unknown> = {}) => ({
    id: 'evt_checkout_test',
    type: 'checkout.session.completed',
    created: 1_700_000_000,
    data: {
        object: {
            id: 'cs_test_xxx',
            metadata: { userId: 'user123', planCode: 'monthly_usd' },
            client_reference_id: 'user123',
            customer: 'cus_test_xxx',
            subscription: 'sub_test_xxx',
            currency: 'usd',
            status: 'complete',
            ...overrides,
        },
    },
});

const makeSubscriptionEvent = (
    type: string,
    status: string,
    extraOverrides: Record<string, unknown> = {},
) => ({
    id: 'evt_sub_test',
    type,
    created: 1_700_000_000,
    data: {
        object: {
            id: 'sub_test_xxx',
            status,
            cancel_at_period_end: false,
            items: { data: [{ current_period_end: 1_703_000_000 }] },
            ...extraOverrides,
        },
    },
});

// ─────────────────────────────────────────────────────────────────────────────

describe('StripeService', () => {
    let service: StripeService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [StripeService],
        }).compile();

        service = module.get<StripeService>(StripeService);
        jest.clearAllMocks();
    });

    // ─── createCheckoutSession ───────────────────────────────────────

    describe('createCheckoutSession', () => {
        const input = {
            userId: 'user123',
            userEmail: 'test@example.com',
            planCode: 'monthly_usd',
            successUrl: 'http://localhost:3000/billing/success',
            cancelUrl: 'http://localhost:3000/billing/cancel',
        };

        it('should pass correct params to stripe.checkout.sessions.create', async () => {
            mockCheckoutCreate.mockResolvedValue({
                url: 'https://checkout.stripe.com/test',
                id: 'cs_test_xxx',
            });

            await service.createCheckoutSession(input);

            expect(mockCheckoutCreate).toHaveBeenCalledWith({
                mode: 'subscription',
                customer_email: input.userEmail,
                line_items: [{ price: 'price_test_monthly', quantity: 1 }],
                metadata: { userId: input.userId, planCode: input.planCode },
                client_reference_id: input.userId,
                success_url: input.successUrl,
                cancel_url: input.cancelUrl,
            });
        });

        it('should return checkoutUrl and providerSessionId when session.url exists', async () => {
            mockCheckoutCreate.mockResolvedValue({
                url: 'https://checkout.stripe.com/test',
                id: 'cs_test_xxx',
            });

            const result = await service.createCheckoutSession(input);

            expect(result).toEqual({
                checkoutUrl: 'https://checkout.stripe.com/test',
                providerSessionId: 'cs_test_xxx',
            });
        });

        it('should throw Error when session.url is absent', async () => {
            mockCheckoutCreate.mockResolvedValue({ url: null, id: 'cs_test' });

            await expect(service.createCheckoutSession(input)).rejects.toThrow(
                Error,
            );
        });
    });

    // ─── createPortalSession ─────────────────────────────────────────

    describe('createPortalSession', () => {
        it('should pass providerCustomerId and ENV.BILLING_SUCCESS_URL to billingPortal.sessions.create', async () => {
            mockPortalCreate.mockResolvedValue({
                url: 'https://billing.stripe.com/test',
            });

            await service.createPortalSession('cus_test_xxx');

            expect(mockPortalCreate).toHaveBeenCalledWith({
                customer: 'cus_test_xxx',
                return_url: 'http://localhost:3000/billing/success',
            });
        });

        it('should return portalUrl from the session', async () => {
            mockPortalCreate.mockResolvedValue({
                url: 'https://billing.stripe.com/test',
            });

            const result = await service.createPortalSession('cus_test_xxx');

            expect(result).toEqual({
                portalUrl: 'https://billing.stripe.com/test',
            });
        });
    });

    // ─── handleWebhookPayload ────────────────────────────────────────

    describe('handleWebhookPayload', () => {
        const rawBody = Buffer.from('{}');
        const sigHeader = 'stripe-sig';

        it('should return CHECKOUT_COMPLETED event with userId from metadata', () => {
            mockConstructEvent.mockReturnValue(makeCheckoutEvent());

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result).toMatchObject({
                type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
                userId: 'user123',
                subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                cancelAtPeriodEnd: false,
                currentPeriodEnd: null,
            });
        });

        it('should fall back to client_reference_id when metadata.userId is absent', () => {
            mockConstructEvent.mockReturnValue(
                makeCheckoutEvent({
                    metadata: { planCode: 'monthly_usd' },
                    client_reference_id: 'ref_user456',
                }),
            );

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result?.userId).toBe('ref_user456');
        });

        it('should return SUBSCRIPTION_UPDATED event with ACTIVE status and empty userId', () => {
            mockConstructEvent.mockReturnValue(
                makeSubscriptionEvent(
                    'customer.subscription.updated',
                    'active',
                ),
            );

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result).toMatchObject({
                type: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
                subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                userId: '',
            });
        });

        it('should return SUBSCRIPTION_UPDATED with PAST_DUE when stripe status is past_due', () => {
            mockConstructEvent.mockReturnValue(
                makeSubscriptionEvent(
                    'customer.subscription.updated',
                    'past_due',
                ),
            );

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.PAST_DUE);
        });

        it('should return SUBSCRIPTION_UPDATED with CANCELED when stripe status is canceled', () => {
            mockConstructEvent.mockReturnValue(
                makeSubscriptionEvent(
                    'customer.subscription.updated',
                    'canceled',
                ),
            );

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.CANCELED);
        });

        it('should return SUBSCRIPTION_DELETED event with CANCELED status', () => {
            mockConstructEvent.mockReturnValue(
                makeSubscriptionEvent(
                    'customer.subscription.deleted',
                    'canceled',
                ),
            );

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result).toMatchObject({
                type: BILLING_EVENT_TYPE.SUBSCRIPTION_DELETED,
                subscriptionStatus: SUBSCRIPTION_STATUS.CANCELED,
                userId: '',
            });
        });

        it('should return null for unknown event type', () => {
            mockConstructEvent.mockReturnValue({
                id: 'evt_unknown',
                type: 'payment_intent.created',
                created: 1_700_000_000,
                data: { object: {} },
            });

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result).toBeNull();
        });

        // ── mapSubscriptionStatus (tested via handleWebhookPayload) ──

        describe('mapSubscriptionStatus', () => {
            const testMapping = (
                stripeStatus: string,
                expected: string,
            ) => {
                it(`should map '${stripeStatus}' to ${expected}`, () => {
                    mockConstructEvent.mockReturnValue(
                        makeSubscriptionEvent(
                            'customer.subscription.updated',
                            stripeStatus,
                        ),
                    );

                    const result = service.handleWebhookPayload(
                        rawBody,
                        sigHeader,
                    );

                    expect(result?.subscriptionStatus).toBe(expected);
                });
            };

            testMapping('active', SUBSCRIPTION_STATUS.ACTIVE);
            testMapping('trialing', SUBSCRIPTION_STATUS.TRIALING);
            testMapping('past_due', SUBSCRIPTION_STATUS.PAST_DUE);
            testMapping('canceled', SUBSCRIPTION_STATUS.CANCELED);
            testMapping('incomplete', SUBSCRIPTION_STATUS.INCOMPLETE);
            testMapping('unpaid', SUBSCRIPTION_STATUS.UNPAID);
            testMapping('incomplete_expired', SUBSCRIPTION_STATUS.CANCELED);
            testMapping('paused', SUBSCRIPTION_STATUS.UNKNOWN);
            testMapping('some_unknown_status', SUBSCRIPTION_STATUS.UNKNOWN);
        });
    });
});
