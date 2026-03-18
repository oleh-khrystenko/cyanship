jest.mock('./client', () => ({
    apiClient: { post: jest.fn() },
}));

import { apiClient } from './client';
import {
    CREDIT_PACKS,
    PAYMENT_TYPE,
    SUBSCRIPTION_PLANS,
} from '@cyanship/types';
import {
    createSubscriptionCheckout,
    createOneOffCheckout,
    createPortalSession,
} from './payments';

// ─────────────────────────────────────────────────────────────────────────────

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

// ─────────────────────────────────────────────────────────────────────────────

describe('payments api', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ─── createSubscriptionCheckout ───────────────────────────────────

    describe('createSubscriptionCheckout', () => {
        it.each(SUBSCRIPTION_PLANS)(
            'should POST to /api/payments/checkout-session with paymentType and planCode for $code',
            async ({ code }) => {
                mockPost.mockResolvedValue({
                    data: { data: { checkoutUrl: 'https://checkout.stripe.com/test' } },
                });

                await createSubscriptionCheckout(code);

                expect(mockPost).toHaveBeenCalledWith(
                    '/payments/checkout-session',
                    {
                        paymentType: PAYMENT_TYPE.SUBSCRIPTION,
                        planCode: code,
                    },
                );
            },
        );

        it.each(SUBSCRIPTION_PLANS)(
            'should return { checkoutUrl } extracted from response.data.data for $code',
            async ({ code }) => {
                mockPost.mockResolvedValue({
                    data: { data: { checkoutUrl: 'https://checkout.stripe.com/test' } },
                });

                const result = await createSubscriptionCheckout(code);

                expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/test' });
            },
        );

        it.each(SUBSCRIPTION_PLANS)(
            'should propagate errors from apiClient.post for $code',
            async ({ code }) => {
                mockPost.mockRejectedValue(new Error('Network error'));

                await expect(createSubscriptionCheckout(code)).rejects.toThrow(
                    'Network error',
                );
            },
        );
    });

    // ─── createOneOffCheckout ─────────────────────────────────────────

    describe('createOneOffCheckout', () => {
        it.each(CREDIT_PACKS)(
            'should POST to /api/payments/checkout-session with paymentType and packCode for $code',
            async ({ code }) => {
                mockPost.mockResolvedValue({
                    data: { data: { checkoutUrl: 'https://checkout.stripe.com/oneoff' } },
                });

                await createOneOffCheckout(code);

                expect(mockPost).toHaveBeenCalledWith(
                    '/payments/checkout-session',
                    {
                        paymentType: PAYMENT_TYPE.ONE_OFF,
                        packCode: code,
                    },
                );
            },
        );

        it.each(CREDIT_PACKS)(
            'should return { checkoutUrl } extracted from response.data.data for $code',
            async ({ code }) => {
                mockPost.mockResolvedValue({
                    data: { data: { checkoutUrl: 'https://checkout.stripe.com/oneoff' } },
                });

                const result = await createOneOffCheckout(code);

                expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/oneoff' });
            },
        );

        it.each(CREDIT_PACKS)(
            'should propagate errors from apiClient.post for $code',
            async ({ code }) => {
                mockPost.mockRejectedValue(new Error('Payment failed'));

                await expect(createOneOffCheckout(code)).rejects.toThrow(
                    'Payment failed',
                );
            },
        );
    });

    // ─── createPortalSession ──────────────────────────────────────────

    describe('createPortalSession', () => {
        it('should POST to /api/payments/portal-session without body', async () => {
            mockPost.mockResolvedValue({
                data: { data: { portalUrl: 'https://billing.stripe.com/test' } },
            });

            await createPortalSession();

            expect(mockPost).toHaveBeenCalledWith('/payments/portal-session');
        });

        it('should return { portalUrl } extracted from response.data.data', async () => {
            mockPost.mockResolvedValue({
                data: { data: { portalUrl: 'https://billing.stripe.com/test' } },
            });

            const result = await createPortalSession();

            expect(result).toEqual({ portalUrl: 'https://billing.stripe.com/test' });
        });

        it('should propagate errors from apiClient.post', async () => {
            mockPost.mockRejectedValue(new Error('Server error'));

            await expect(createPortalSession()).rejects.toThrow('Server error');
        });
    });
});
