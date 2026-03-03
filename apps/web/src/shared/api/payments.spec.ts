jest.mock('./client', () => ({
    apiClient: { post: jest.fn() },
}));

import { apiClient } from './client';
import { createCheckoutSession, createPortalSession } from './payments';

// ─────────────────────────────────────────────────────────────────────────────

const mockPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

// ─────────────────────────────────────────────────────────────────────────────

describe('payments api', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ─── createCheckoutSession ───────────────────────────────────────

    describe('createCheckoutSession', () => {
        it('should POST to /api/payments/checkout-session with planCode in body', async () => {
            mockPost.mockResolvedValue({
                data: { data: { checkoutUrl: 'https://checkout.stripe.com/test' } },
            });

            await createCheckoutSession('monthly_usd');

            expect(mockPost).toHaveBeenCalledWith(
                '/api/payments/checkout-session',
                { planCode: 'monthly_usd' },
            );
        });

        it('should return { checkoutUrl } extracted from response.data.data', async () => {
            mockPost.mockResolvedValue({
                data: { data: { checkoutUrl: 'https://checkout.stripe.com/test' } },
            });

            const result = await createCheckoutSession('monthly_usd');

            expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/test' });
        });

        it('should propagate errors from apiClient.post', async () => {
            mockPost.mockRejectedValue(new Error('Network error'));

            await expect(createCheckoutSession('monthly_usd')).rejects.toThrow(
                'Network error',
            );
        });
    });

    // ─── createPortalSession ─────────────────────────────────────────

    describe('createPortalSession', () => {
        it('should POST to /api/payments/portal-session without body', async () => {
            mockPost.mockResolvedValue({
                data: { data: { portalUrl: 'https://billing.stripe.com/test' } },
            });

            await createPortalSession();

            expect(mockPost).toHaveBeenCalledWith('/api/payments/portal-session');
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
