import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
    BILLING_EVENT_TYPE,
    PAYMENT_TYPE,
    RESPONSE_CODE,
    SUBSCRIPTION_STATUS,
    type BillingWebhookEvent,
    type CreditPackCode,
} from '@lucidkit/types';

import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { User } from '../users/schemas/user.schema';
import { ProcessedWebhookEvent } from './schemas/processed-webhook-event.schema';
import { UsersService } from '../users/users.service';

jest.mock('../../config/env', () => ({
    ENV: {
        BILLING_SUCCESS_URL: 'http://localhost:3000/billing/success',
        BILLING_CANCEL_URL: 'http://localhost:3000/billing/cancel',
        STRIPE_PRICE_MONTHLY_USD: 'price_test_monthly',
        PAYMENTS_SUBSCRIPTION_ENABLED: true,
        PAYMENTS_ONE_OFF_ENABLED: true,
    },
    STRIPE_CREDIT_PACKS: {
        credits_5: { priceId: 'price_credits5_test', credits: 5 },
        credits_10: { priceId: 'price_credits10_test', credits: 10 },
        credits_20: { priceId: 'price_credits20_test', credits: 20 },
    },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const envModule = require('../../config/env') as {
    ENV: Record<string, unknown>;
    STRIPE_CREDIT_PACKS: Record<string, { priceId: string; credits: number }>;
};

const MOCK_USER_ID = '507f1f77bcf86cd799439011';

const mockUser = (overrides: Record<string, unknown> = {}) => ({
    _id: { toString: () => MOCK_USER_ID },
    email: 'test@example.com',
    billing: null as unknown,
    ...overrides,
});

const mockPaymentProvider = {
    createCheckoutSession: jest.fn(),
    createPortalSession: jest.fn(),
    handleWebhookPayload: jest.fn(),
};

const mockUserModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
};

const mockWebhookEventModel = {
    create: jest.fn(),
};

const mockUsersService = {
    addCredits: jest.fn(),
};

describe('PaymentsService', () => {
    let service: PaymentsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentsService,
                { provide: PAYMENT_PROVIDER, useValue: mockPaymentProvider },
                {
                    provide: getModelToken(User.name),
                    useValue: mockUserModel,
                },
                {
                    provide: getModelToken(ProcessedWebhookEvent.name),
                    useValue: mockWebhookEventModel,
                },
                { provide: UsersService, useValue: mockUsersService },
            ],
        }).compile();

        service = module.get<PaymentsService>(PaymentsService);
        jest.clearAllMocks();

        // Reset feature flags to defaults
        envModule.ENV.PAYMENTS_SUBSCRIPTION_ENABLED = true;
        envModule.ENV.PAYMENTS_ONE_OFF_ENABLED = true;
    });

    // ─── createCheckoutSession (subscription) ─────────────────────────

    describe('createCheckoutSession (subscription)', () => {
        it('should call paymentProvider with correct args and return checkoutUrl', async () => {
            const user = mockUser({ billing: null });
            mockUserModel.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(user),
            });
            mockPaymentProvider.createCheckoutSession.mockResolvedValue({
                checkoutUrl: 'https://checkout.stripe.com/test',
                providerSessionId: 'cs_test',
            });

            const result = await service.createCheckoutSession(MOCK_USER_ID, {
                paymentType: PAYMENT_TYPE.SUBSCRIPTION,
                planCode: 'monthly_usd',
            });

            expect(mockPaymentProvider.createCheckoutSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: MOCK_USER_ID,
                    userEmail: user.email,
                    paymentType: PAYMENT_TYPE.SUBSCRIPTION,
                    planCode: 'monthly_usd',
                    priceId: 'price_test_monthly',
                    successUrl: 'http://localhost:3000/billing/success',
                    cancelUrl: 'http://localhost:3000/billing/cancel',
                }),
            );
            expect(result).toEqual({
                checkoutUrl: 'https://checkout.stripe.com/test',
            });
        });

        it('should use ENV.BILLING_SUCCESS_URL and ENV.BILLING_CANCEL_URL', async () => {
            const user = mockUser({ billing: null });
            mockUserModel.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(user),
            });
            mockPaymentProvider.createCheckoutSession.mockResolvedValue({
                checkoutUrl: 'https://checkout.stripe.com/test',
                providerSessionId: 'cs_test',
            });

            await service.createCheckoutSession(MOCK_USER_ID, {
                paymentType: PAYMENT_TYPE.SUBSCRIPTION,
                planCode: 'monthly_usd',
            });

            expect(mockPaymentProvider.createCheckoutSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    successUrl: 'http://localhost:3000/billing/success',
                    cancelUrl: 'http://localhost:3000/billing/cancel',
                }),
            );
        });

        it('should throw ConflictException with ALREADY_SUBSCRIBED when user has active subscription', async () => {
            const user = mockUser({ billing: { hasActiveSubscription: true } });
            mockUserModel.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(user),
            });

            const error = await service
                .createCheckoutSession(MOCK_USER_ID, {
                    paymentType: PAYMENT_TYPE.SUBSCRIPTION,
                    planCode: 'monthly_usd',
                })
                .catch((e: unknown) => e);

            expect(error).toBeInstanceOf(ConflictException);
            expect((error as ConflictException).getResponse()).toMatchObject({
                code: RESPONSE_CODE.ALREADY_SUBSCRIBED,
            });
        });

        it('should throw BadRequestException when user not found', async () => {
            mockUserModel.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });

            await expect(
                service.createCheckoutSession(MOCK_USER_ID, {
                    paymentType: PAYMENT_TYPE.SUBSCRIPTION,
                    planCode: 'monthly_usd',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw when PAYMENTS_SUBSCRIPTION_ENABLED is false', async () => {
            envModule.ENV.PAYMENTS_SUBSCRIPTION_ENABLED = false;

            await expect(
                service.createCheckoutSession(MOCK_USER_ID, {
                    paymentType: PAYMENT_TYPE.SUBSCRIPTION,
                    planCode: 'monthly_usd',
                }),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ─── createCheckoutSession (one-off) ──────────────────────────────

    describe('createCheckoutSession (one-off)', () => {
        it('should create one-off checkout session for valid packCode', async () => {
            mockUserModel.findById.mockReturnValue({
                lean: () =>
                    Promise.resolve({
                        _id: MOCK_USER_ID,
                        email: 'user@test.com',
                        billing: null,
                    }),
            });
            mockPaymentProvider.createCheckoutSession.mockResolvedValue({
                checkoutUrl: 'https://checkout.stripe.com/one-off',
                providerSessionId: 'cs_test_oneoff',
            });

            const result = await service.createCheckoutSession(MOCK_USER_ID, {
                paymentType: PAYMENT_TYPE.ONE_OFF,
                packCode: 'credits_5',
            });

            expect(result.checkoutUrl).toBe(
                'https://checkout.stripe.com/one-off',
            );
            expect(
                mockPaymentProvider.createCheckoutSession,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    paymentType: PAYMENT_TYPE.ONE_OFF,
                    planCode: 'credits_5',
                    priceId: 'price_credits5_test',
                    credits: 5,
                }),
            );
        });

        it('should throw BadRequestException for invalid packCode', async () => {
            mockUserModel.findById.mockReturnValue({
                lean: () =>
                    Promise.resolve({
                        _id: MOCK_USER_ID,
                        email: 'user@test.com',
                    }),
            });

            await expect(
                service.createCheckoutSession(MOCK_USER_ID, {
                    paymentType: PAYMENT_TYPE.ONE_OFF,
                    packCode: 'invalid_pack' as CreditPackCode,
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw when PAYMENTS_ONE_OFF_ENABLED is false', async () => {
            envModule.ENV.PAYMENTS_ONE_OFF_ENABLED = false;

            await expect(
                service.createCheckoutSession(MOCK_USER_ID, {
                    paymentType: PAYMENT_TYPE.ONE_OFF,
                    packCode: 'credits_5',
                }),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ─── createPortalSession ─────────────────────────────────────────

    describe('createPortalSession', () => {
        it('should call paymentProvider.createPortalSession with providerCustomerId and return portalUrl', async () => {
            const user = mockUser({
                billing: { providerCustomerId: 'cus_test_xxx' },
            });
            mockUserModel.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(user),
            });
            mockPaymentProvider.createPortalSession.mockResolvedValue({
                portalUrl: 'https://billing.stripe.com/test',
            });

            const result = await service.createPortalSession(MOCK_USER_ID);

            expect(mockPaymentProvider.createPortalSession).toHaveBeenCalledWith(
                'cus_test_xxx',
            );
            expect(result).toEqual({
                portalUrl: 'https://billing.stripe.com/test',
            });
        });

        it('should throw BadRequestException with NO_BILLING_ACCOUNT when billing subdocument is null', async () => {
            const user = mockUser({ billing: null });
            mockUserModel.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(user),
            });

            const error = await service
                .createPortalSession(MOCK_USER_ID)
                .catch((e: unknown) => e);

            expect(error).toBeInstanceOf(BadRequestException);
            expect((error as BadRequestException).getResponse()).toMatchObject({
                code: RESPONSE_CODE.NO_BILLING_ACCOUNT,
            });
        });

        it('should throw BadRequestException with NO_BILLING_ACCOUNT when providerCustomerId is null', async () => {
            const user = mockUser({
                billing: { providerCustomerId: null },
            });
            mockUserModel.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(user),
            });

            const error = await service
                .createPortalSession(MOCK_USER_ID)
                .catch((e: unknown) => e);

            expect(error).toBeInstanceOf(BadRequestException);
            expect((error as BadRequestException).getResponse()).toMatchObject({
                code: RESPONSE_CODE.NO_BILLING_ACCOUNT,
            });
        });

        it('should throw BadRequestException when user not found', async () => {
            mockUserModel.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });

            await expect(
                service.createPortalSession(MOCK_USER_ID),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ─── handleWebhook ───────────────────────────────────────────────

    describe('handleWebhook', () => {
        const rawBody = Buffer.from('{}');
        const signature = 'stripe-sig-test';

        // ── Basic flow ───────────────────────────────────────────────

        describe('basic flow', () => {
            it('should return without action when handleWebhookPayload returns null', async () => {
                mockPaymentProvider.handleWebhookPayload.mockReturnValue(null);

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockWebhookEventModel.create).not.toHaveBeenCalled();
                expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
            });

            it('should process CHECKOUT_COMPLETED event and call findByIdAndUpdate with correct billing fields', async () => {
                const occurredAt = new Date('2024-01-01');
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
                    providerEventId: 'evt_test',
                    occurredAt,
                    userId: MOCK_USER_ID,
                    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    raw: {
                        customer: 'cus_test',
                        subscription: 'sub_test',
                        currency: 'usd',
                        status: 'complete',
                        metadata: { planCode: 'monthly_usd' },
                    },
                };

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockUser()),
                });
                mockUserModel.findByIdAndUpdate.mockResolvedValue({});

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockWebhookEventModel.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        provider: 'stripe',
                        providerEventId: 'evt_test',
                        type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
                        userId: MOCK_USER_ID,
                    }),
                );
                expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
                    MOCK_USER_ID,
                    {
                        $set: expect.objectContaining({
                            'billing.provider': 'stripe',
                            'billing.hasActiveSubscription': true,
                            'billing.providerCustomerId': 'cus_test',
                            'billing.providerSubscriptionId': 'sub_test',
                            'billing.planCode': 'monthly_usd',
                            'billing.currency': 'usd',
                        }),
                    },
                );
            });
        });

        // ── userId resolution ────────────────────────────────────────

        describe('userId resolution', () => {
            it('should use event.userId directly when non-empty and not call findOne', async () => {
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
                    providerEventId: 'evt_direct_id',
                    occurredAt: new Date(),
                    userId: MOCK_USER_ID,
                    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    raw: {},
                };

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockUser()),
                });
                mockUserModel.findByIdAndUpdate.mockResolvedValue({});

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUserModel.findOne).not.toHaveBeenCalled();
            });

            it('should look up user by providerSubscriptionId when event.userId is empty', async () => {
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
                    providerEventId: 'evt_sub_lookup',
                    occurredAt: new Date(),
                    userId: '',
                    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    raw: { id: 'sub_test_xxx' },
                };

                const foundUser = { _id: { toString: () => MOCK_USER_ID } };
                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);
                mockUserModel.findOne.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(foundUser),
                });
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockUser()),
                });
                mockUserModel.findByIdAndUpdate.mockResolvedValue({});

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUserModel.findOne).toHaveBeenCalledWith({
                    'billing.providerSubscriptionId': 'sub_test_xxx',
                });
            });

            it('should return without action when userId is empty and raw.id is missing', async () => {
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
                    providerEventId: 'evt_no_raw_id',
                    occurredAt: new Date(),
                    userId: '',
                    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    raw: {},
                };

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockWebhookEventModel.create).not.toHaveBeenCalled();
                expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
            });

            it('should return without action when findOne finds no user for subscriptionId', async () => {
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
                    providerEventId: 'evt_no_user_found',
                    occurredAt: new Date(),
                    userId: '',
                    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    raw: { id: 'sub_not_found' },
                };

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);
                mockUserModel.findOne.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null),
                });

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockWebhookEventModel.create).not.toHaveBeenCalled();
                expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
            });
        });

        // ── Idempotency ──────────────────────────────────────────────

        describe('idempotency', () => {
            it('should return without action when create throws MongoDB duplicate key error (11000)', async () => {
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
                    providerEventId: 'evt_dup',
                    occurredAt: new Date(),
                    userId: MOCK_USER_ID,
                    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    raw: {},
                };

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);
                const dupError = Object.assign(new Error('E11000 duplicate key'), {
                    code: 11000,
                });
                mockWebhookEventModel.create.mockRejectedValue(dupError);

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
            });

            it('should propagate non-duplicate errors from webhookEventModel.create', async () => {
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
                    providerEventId: 'evt_err',
                    occurredAt: new Date(),
                    userId: MOCK_USER_ID,
                    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    raw: {},
                };

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);
                mockWebhookEventModel.create.mockRejectedValue(
                    new Error('connection error'),
                );

                await expect(
                    service.handleWebhook('stripe', rawBody, signature),
                ).rejects.toThrow('connection error');
            });
        });

        // ── Out-of-order protection ──────────────────────────────────

        describe('out-of-order protection', () => {
            const makeEvent = (occurredAt: Date): BillingWebhookEvent => ({
                type: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
                providerEventId: 'evt_ooo',
                occurredAt,
                userId: MOCK_USER_ID,
                subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                raw: { status: 'active' },
            });

            it('should skip stale event when occurredAt is before lastProviderEventAt', async () => {
                const lastEventAt = new Date('2024-06-01T00:00:00Z');
                const staleAt = new Date('2024-05-31T00:00:00Z');

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(
                    makeEvent(staleAt),
                );
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(
                        mockUser({ billing: { lastProviderEventAt: lastEventAt } }),
                    ),
                });

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
            });

            it('should process event when occurredAt equals lastProviderEventAt (strict < check)', async () => {
                const sameAt = new Date('2024-06-01T00:00:00Z');

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(
                    makeEvent(sameAt),
                );
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(
                        mockUser({ billing: { lastProviderEventAt: sameAt } }),
                    ),
                });
                mockUserModel.findByIdAndUpdate.mockResolvedValue({});

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalled();
            });

            it('should process event when occurredAt is after lastProviderEventAt', async () => {
                const lastEventAt = new Date('2024-05-01T00:00:00Z');
                const newerAt = new Date('2024-06-01T00:00:00Z');

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(
                    makeEvent(newerAt),
                );
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(
                        mockUser({ billing: { lastProviderEventAt: lastEventAt } }),
                    ),
                });
                mockUserModel.findByIdAndUpdate.mockResolvedValue({});

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalled();
            });
        });

        // ── Billing state per event type ─────────────────────────────

        describe('billing state per event type', () => {
            const occurredAt = new Date('2024-01-01T00:00:00Z');

            it('should set correct billing state for CHECKOUT_COMPLETED', async () => {
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
                    providerEventId: 'evt_checkout',
                    occurredAt,
                    userId: MOCK_USER_ID,
                    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    raw: {
                        customer: 'cus_abc',
                        subscription: 'sub_abc',
                        currency: 'usd',
                        status: 'complete',
                        metadata: { planCode: 'monthly_usd' },
                    },
                };

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockUser()),
                });
                mockUserModel.findByIdAndUpdate.mockResolvedValue({});

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
                    MOCK_USER_ID,
                    {
                        $set: expect.objectContaining({
                            'billing.provider': 'stripe',
                            'billing.providerCustomerId': 'cus_abc',
                            'billing.providerSubscriptionId': 'sub_abc',
                            'billing.planCode': 'monthly_usd',
                            'billing.currency': 'usd',
                            'billing.hasActiveSubscription': true,
                            'billing.subscriptionStatus': SUBSCRIPTION_STATUS.ACTIVE,
                        }),
                    },
                );
            });

            it('should set hasActiveSubscription=true and update currentPeriodEnd for SUBSCRIPTION_UPDATED with ACTIVE status', async () => {
                const currentPeriodEnd = new Date('2025-01-01T00:00:00Z');
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
                    providerEventId: 'evt_updated_active',
                    occurredAt,
                    userId: MOCK_USER_ID,
                    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                    currentPeriodEnd,
                    cancelAtPeriodEnd: false,
                    raw: { status: 'active' },
                };

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockUser()),
                });
                mockUserModel.findByIdAndUpdate.mockResolvedValue({});

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
                    MOCK_USER_ID,
                    {
                        $set: expect.objectContaining({
                            'billing.hasActiveSubscription': true,
                            'billing.subscriptionStatus': SUBSCRIPTION_STATUS.ACTIVE,
                            'billing.currentPeriodEnd': currentPeriodEnd,
                            'billing.cancelAtPeriodEnd': false,
                        }),
                    },
                );
            });

            it('should set hasActiveSubscription=false for SUBSCRIPTION_UPDATED with PAST_DUE status', async () => {
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
                    providerEventId: 'evt_past_due',
                    occurredAt,
                    userId: MOCK_USER_ID,
                    subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    raw: { status: 'past_due' },
                };

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockUser()),
                });
                mockUserModel.findByIdAndUpdate.mockResolvedValue({});

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
                    MOCK_USER_ID,
                    {
                        $set: expect.objectContaining({
                            'billing.hasActiveSubscription': false,
                            'billing.subscriptionStatus': SUBSCRIPTION_STATUS.PAST_DUE,
                        }),
                    },
                );
            });

            it('should set canceled state for SUBSCRIPTION_DELETED', async () => {
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.SUBSCRIPTION_DELETED,
                    providerEventId: 'evt_deleted',
                    occurredAt,
                    userId: MOCK_USER_ID,
                    subscriptionStatus: SUBSCRIPTION_STATUS.CANCELED,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    raw: {},
                };

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockUser()),
                });
                mockUserModel.findByIdAndUpdate.mockResolvedValue({});

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
                    MOCK_USER_ID,
                    {
                        $set: expect.objectContaining({
                            'billing.subscriptionStatus': SUBSCRIPTION_STATUS.CANCELED,
                            'billing.hasActiveSubscription': false,
                            'billing.providerSubscriptionStatus': 'canceled',
                        }),
                    },
                );
            });
        });

        // ── One-off webhook flow ─────────────────────────────────────

        describe('one-off webhook flow', () => {
            const oneOffEvent: BillingWebhookEvent = {
                type: BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED,
                providerEventId: 'evt_oneoff_123',
                occurredAt: new Date('2026-03-01'),
                userId: MOCK_USER_ID,
                creditsAmount: 5,
                raw: {},
            };

            it('should add credits on ONE_OFF_PAYMENT_COMPLETED', async () => {
                mockPaymentProvider.handleWebhookPayload.mockReturnValue(oneOffEvent);
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockUser()),
                });
                mockUsersService.addCredits.mockResolvedValue(undefined);

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUsersService.addCredits).toHaveBeenCalledWith(
                    MOCK_USER_ID,
                    5,
                );
                expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
            });

            it('should NOT apply out-of-order check for one-off events', async () => {
                const staleUserBilling = {
                    lastProviderEventAt: new Date('2026-03-15'),
                };
                mockPaymentProvider.handleWebhookPayload.mockReturnValue({
                    ...oneOffEvent,
                    occurredAt: new Date('2026-02-01'),
                });
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest
                        .fn()
                        .mockResolvedValue(
                            mockUser({ billing: staleUserBilling }),
                        ),
                });
                mockUsersService.addCredits.mockResolvedValue(undefined);

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUsersService.addCredits).toHaveBeenCalledWith(
                    MOCK_USER_ID,
                    5,
                );
            });

            it('should warn and skip if creditsAmount is 0', async () => {
                mockPaymentProvider.handleWebhookPayload.mockReturnValue({
                    ...oneOffEvent,
                    creditsAmount: 0,
                });
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockUser()),
                });

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUsersService.addCredits).not.toHaveBeenCalled();
            });
        });

        // ── User not found after idempotency ─────────────────────────

        describe('user not found after idempotency check', () => {
            it('should return without action when findById returns null', async () => {
                const event: BillingWebhookEvent = {
                    type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
                    providerEventId: 'evt_ghost_user',
                    occurredAt: new Date(),
                    userId: MOCK_USER_ID,
                    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    raw: {},
                };

                mockPaymentProvider.handleWebhookPayload.mockReturnValue(event);
                mockWebhookEventModel.create.mockResolvedValue({});
                mockUserModel.findById.mockReturnValue({
                    lean: jest.fn().mockResolvedValue(null),
                });

                await service.handleWebhook('stripe', rawBody, signature);

                expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
            });
        });
    });
});
