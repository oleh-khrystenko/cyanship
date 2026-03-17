jest.mock('stripe');
jest.mock('../../../config/env', () => ({
    ENV: {
        STRIPE_SECRET_KEY: 'sk_test_xxx',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
    },
}));

import Stripe from 'stripe';
import { Test, TestingModule } from '@nestjs/testing';
import {
    BILLING_EVENT_TYPE,
    PAYMENT_TYPE,
    SUBSCRIPTION_STATUS,
} from '@cyanship/types';

import { StripeService } from './stripe.service';
import { CreateCheckoutInput } from '../interfaces/payment-provider.interface';

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
    () => mockStripeInstance as unknown as Stripe
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeCheckoutEvent = (overrides: Record<string, unknown> = {}) => ({
    id: 'evt_checkout_test',
    type: 'checkout.session.completed',
    created: 1_700_000_000,
    data: {
        object: {
            id: 'cs_test_xxx',
            mode: 'subscription',
            metadata: {
                userId: 'user123',
                planCode: 'pro',
                credits: '0',
            },
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
    extraOverrides: Record<string, unknown> = {}
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

const subscriptionInput: CreateCheckoutInput = {
    userId: 'user123',
    userEmail: 'test@example.com',
    paymentType: PAYMENT_TYPE.SUBSCRIPTION,
    planCode: 'pro',
    priceId: 'price_test_pro',
    successUrl: 'http://localhost:3000/billing/success',
    cancelUrl: 'http://localhost:3000/billing/cancel',
};

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
        it('should pass correct params to stripe.checkout.sessions.create for subscription', async () => {
            mockCheckoutCreate.mockResolvedValue({
                url: 'https://checkout.stripe.com/test',
                id: 'cs_test_xxx',
            });

            await service.createCheckoutSession(subscriptionInput);

            expect(mockCheckoutCreate).toHaveBeenCalledWith({
                mode: 'subscription',
                customer_email: subscriptionInput.userEmail,
                line_items: [{ price: 'price_test_pro', quantity: 1 }],
                metadata: {
                    userId: subscriptionInput.userId,
                    planCode: subscriptionInput.planCode,
                    credits: '0',
                },
                client_reference_id: subscriptionInput.userId,
                success_url: subscriptionInput.successUrl,
                cancel_url: subscriptionInput.cancelUrl,
            });
        });

        it('should pass customer instead of customer_email when providerCustomerId is provided', async () => {
            mockCheckoutCreate.mockResolvedValue({
                url: 'https://checkout.stripe.com/existing',
                id: 'cs_test_existing',
            });

            await service.createCheckoutSession({
                ...subscriptionInput,
                providerCustomerId: 'cus_existing_123',
            });

            expect(mockCheckoutCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    customer: 'cus_existing_123',
                })
            );
            expect(mockCheckoutCreate).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    customer_email: expect.anything(),
                })
            );
        });

        it('should return checkoutUrl and providerSessionId when session.url exists', async () => {
            mockCheckoutCreate.mockResolvedValue({
                url: 'https://checkout.stripe.com/test',
                id: 'cs_test_xxx',
            });

            const result =
                await service.createCheckoutSession(subscriptionInput);

            expect(result).toEqual({
                checkoutUrl: 'https://checkout.stripe.com/test',
                providerSessionId: 'cs_test_xxx',
            });
        });

        it('should throw Error when session.url is absent', async () => {
            mockCheckoutCreate.mockResolvedValue({ url: null, id: 'cs_test' });

            await expect(
                service.createCheckoutSession(subscriptionInput)
            ).rejects.toThrow(Error);
        });

        it('should create payment mode session for ONE_OFF', async () => {
            const oneOffInput: CreateCheckoutInput = {
                userId: 'user123',
                userEmail: 'test@example.com',
                paymentType: PAYMENT_TYPE.ONE_OFF,
                planCode: 'basic',
                priceId: 'price_test_basic',
                credits: 5,
                successUrl: 'https://example.com/success',
                cancelUrl: 'https://example.com/cancel',
            };

            mockCheckoutCreate.mockResolvedValue({
                id: 'cs_test_oneoff',
                url: 'https://checkout.stripe.com/pay/oneoff',
            });

            const result = await service.createCheckoutSession(oneOffInput);

            expect(mockCheckoutCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    mode: 'payment',
                    line_items: [{ price: 'price_test_basic', quantity: 1 }],
                    metadata: expect.objectContaining({
                        credits: '5',
                    }),
                })
            );
            expect(result.checkoutUrl).toBe(
                'https://checkout.stripe.com/pay/oneoff'
            );
        });
    });

    // ─── createPortalSession ─────────────────────────────────────────

    describe('createPortalSession', () => {
        it('should pass providerCustomerId and returnUrl to billingPortal.sessions.create', async () => {
            mockPortalCreate.mockResolvedValue({
                url: 'https://billing.stripe.com/test',
            });

            await service.createPortalSession('cus_test_xxx', 'http://localhost:3000/en/billing');

            expect(mockPortalCreate).toHaveBeenCalledWith({
                customer: 'cus_test_xxx',
                return_url: 'http://localhost:3000/en/billing',
            });
        });

        it('should return portalUrl from the session', async () => {
            mockPortalCreate.mockResolvedValue({
                url: 'https://billing.stripe.com/test',
            });

            const result = await service.createPortalSession('cus_test_xxx', 'http://localhost:3000/en/billing');

            expect(result).toEqual({
                portalUrl: 'https://billing.stripe.com/test',
            });
        });
    });

    // ─── handleWebhookPayload ────────────────────────────────────────

    describe('handleWebhookPayload', () => {
        const rawBody = Buffer.from('{}');
        const sigHeader = 'stripe-sig';

        it('should return CHECKOUT_COMPLETED event with userId from metadata for subscription checkout', () => {
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
                    metadata: { planCode: 'pro', credits: '0' },
                    client_reference_id: 'ref_user456',
                })
            );

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result?.userId).toBe('ref_user456');
        });

        it('should return SUBSCRIPTION_UPDATED event with ACTIVE status and empty userId', () => {
            mockConstructEvent.mockReturnValue(
                makeSubscriptionEvent('customer.subscription.updated', 'active')
            );

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result).toMatchObject({
                type: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
                subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                userId: '',
            });
        });

        it('should set cancelAtPeriodEnd=true when cancel_at is set (even if cancel_at_period_end is false)', () => {
            mockConstructEvent.mockReturnValue(
                makeSubscriptionEvent('customer.subscription.updated', 'active', {
                    cancel_at_period_end: false,
                    cancel_at: 1_776_443_119,
                })
            );

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result).toMatchObject({
                type: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
                subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                cancelAtPeriodEnd: true,
            });
        });

        it('should return SUBSCRIPTION_UPDATED with PAST_DUE when stripe status is past_due', () => {
            mockConstructEvent.mockReturnValue(
                makeSubscriptionEvent(
                    'customer.subscription.updated',
                    'past_due'
                )
            );

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result?.subscriptionStatus).toBe(
                SUBSCRIPTION_STATUS.PAST_DUE
            );
        });

        it('should return SUBSCRIPTION_UPDATED with CANCELED when stripe status is canceled', () => {
            mockConstructEvent.mockReturnValue(
                makeSubscriptionEvent(
                    'customer.subscription.updated',
                    'canceled'
                )
            );

            const result = service.handleWebhookPayload(rawBody, sigHeader);

            expect(result?.subscriptionStatus).toBe(
                SUBSCRIPTION_STATUS.CANCELED
            );
        });

        it('should return SUBSCRIPTION_DELETED event with CANCELED status', () => {
            mockConstructEvent.mockReturnValue(
                makeSubscriptionEvent(
                    'customer.subscription.deleted',
                    'canceled'
                )
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

        // ── One-off checkout completed ────────────────────────────────

        describe('checkout.session.completed (payment mode)', () => {
            it('should return ONE_OFF_PAYMENT_COMPLETED for mode=payment + paid', () => {
                mockConstructEvent.mockReturnValue(
                    makeCheckoutEvent({
                        mode: 'payment',
                        payment_status: 'paid',
                        metadata: {
                            userId: 'user123',
                            credits: '5',
                            planCode: 'basic',
                        },
                        client_reference_id: 'user123',
                    })
                );

                const result = service.handleWebhookPayload(rawBody, sigHeader);

                expect(result?.type).toBe(
                    BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED
                );
                expect(result?.creditsAmount).toBe(5);
                expect(result?.userId).toBe('user123');
            });

            it('should return null for mode=payment + unpaid (async method pending)', () => {
                mockConstructEvent.mockReturnValue(
                    makeCheckoutEvent({
                        mode: 'payment',
                        payment_status: 'unpaid',
                        metadata: {
                            userId: 'user123',
                            credits: '5',
                            planCode: 'basic',
                        },
                        client_reference_id: 'user123',
                    })
                );

                const result = service.handleWebhookPayload(rawBody, sigHeader);

                expect(result).toBeNull();
            });

            it('should return CHECKOUT_COMPLETED for mode=subscription with creditsAmount from metadata', () => {
                mockConstructEvent.mockReturnValue(
                    makeCheckoutEvent({
                        mode: 'subscription',
                        metadata: {
                            userId: 'user123',
                            planCode: 'starter',
                            credits: '1000',
                        },
                    })
                );

                const result = service.handleWebhookPayload(rawBody, sigHeader);

                expect(result?.type).toBe(
                    BILLING_EVENT_TYPE.CHECKOUT_COMPLETED
                );
                expect(result?.creditsAmount).toBe(1000);
            });

            it('should return CHECKOUT_COMPLETED without creditsAmount when credits metadata is 0', () => {
                mockConstructEvent.mockReturnValue(
                    makeCheckoutEvent({ mode: 'subscription' })
                );

                const result = service.handleWebhookPayload(rawBody, sigHeader);

                expect(result?.type).toBe(
                    BILLING_EVENT_TYPE.CHECKOUT_COMPLETED
                );
                expect(result?.creditsAmount).toBeUndefined();
            });
        });

        // ── checkout.session.async_payment_succeeded ──────────────────

        describe('checkout.session.async_payment_succeeded', () => {
            it('should return ONE_OFF_PAYMENT_COMPLETED for async payment with mode=payment + paid', () => {
                mockConstructEvent.mockReturnValue({
                    id: 'evt_async_paid',
                    type: 'checkout.session.async_payment_succeeded',
                    created: 1_700_000_000,
                    data: {
                        object: {
                            id: 'cs_async_xxx',
                            mode: 'payment',
                            payment_status: 'paid',
                            metadata: {
                                userId: 'user_async',
                                credits: '10',
                                planCode: 'max',
                            },
                            client_reference_id: 'user_async',
                        },
                    },
                });

                const result = service.handleWebhookPayload(rawBody, sigHeader);

                expect(result).toMatchObject({
                    type: BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED,
                    providerEventId: 'evt_async_paid',
                    userId: 'user_async',
                    creditsAmount: 10,
                    packCode: 'max',
                });
            });

            it('should return null for async payment with mode=payment + unpaid', () => {
                mockConstructEvent.mockReturnValue({
                    id: 'evt_async_unpaid',
                    type: 'checkout.session.async_payment_succeeded',
                    created: 1_700_000_000,
                    data: {
                        object: {
                            id: 'cs_async_unpaid',
                            mode: 'payment',
                            payment_status: 'unpaid',
                            metadata: { userId: 'user_async' },
                            client_reference_id: 'user_async',
                        },
                    },
                });

                const result = service.handleWebhookPayload(rawBody, sigHeader);

                expect(result).toBeNull();
            });
        });

        // ── mapSubscriptionStatus (tested via handleWebhookPayload) ──

        describe('mapSubscriptionStatus', () => {
            const testMapping = (stripeStatus: string, expected: string) => {
                it(`should map '${stripeStatus}' to ${expected}`, () => {
                    mockConstructEvent.mockReturnValue(
                        makeSubscriptionEvent(
                            'customer.subscription.updated',
                            stripeStatus
                        )
                    );

                    const result = service.handleWebhookPayload(
                        rawBody,
                        sigHeader
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
