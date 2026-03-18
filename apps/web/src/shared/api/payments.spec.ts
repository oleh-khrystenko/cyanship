jest.mock('./client', () => ({
    apiClient: { post: jest.fn() },
}));

import { apiClient } from './client';
import { PAYMENT_TYPE } from '@cyanship/types';
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
        it('should POST to /api/payments/checkout-session with paymentType and planCode', async () => {
            mockPost.mockResolvedValue({
                data: { data: { checkoutUrl: 'https://checkout.stripe.com/test' } },
            });

            await createSubscriptionCheckout('monthly_usd');

            expect(mockPost).toHaveBeenCalledWith(
                '/payments/checkout-session',
                {
                    paymentType: PAYMENT_TYPE.SUBSCRIPTION,
                    planCode: 'monthly_usd',
                },
            );
        });

        it('should return { checkoutUrl } extracted from response.data.data', async () => {
            mockPost.mockResolvedValue({
                data: { data: { checkoutUrl: 'https://checkout.stripe.com/test' } },
            });

            const result = await createSubscriptionCheckout('monthly_usd');

            expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/test' });
        });

        it('should propagate errors from apiClient.post', async () => {
            mockPost.mockRejectedValue(new Error('Network error'));

            await expect(createSubscriptionCheckout('monthly_usd')).rejects.toThrow(
                'Network error',
            );
        });
    });

    // ─── createOneOffCheckout ─────────────────────────────────────────

    describe('createOneOffCheckout', () => {
        it('should POST to /api/payments/checkout-session with paymentType and packCode', async () => {
            mockPost.mockResolvedValue({
                data: { data: { checkoutUrl: 'https://checkout.stripe.com/oneoff' } },
            });

            await createOneOffCheckout('credits_5');

            expect(mockPost).toHaveBeenCalledWith(
                '/payments/checkout-session',
                {
                    paymentType: PAYMENT_TYPE.ONE_OFF,
                    packCode: 'credits_5',
                },
            );
        });

        it('should return { checkoutUrl } extracted from response.data.data', async () => {
            mockPost.mockResolvedValue({
                data: { data: { checkoutUrl: 'https://checkout.stripe.com/oneoff' } },
            });

            const result = await createOneOffCheckout('credits_10');

            expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/oneoff' });
        });

        it('should propagate errors from apiClient.post', async () => {
            mockPost.mockRejectedValue(new Error('Payment failed'));

            await expect(createOneOffCheckout('credits_5')).rejects.toThrow(
                'Payment failed',
            );
        });
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
