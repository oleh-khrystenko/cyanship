import { apiClient } from './client';

export async function createCheckoutSession(
    planCode: string,
): Promise<{ checkoutUrl: string }> {
    const { data } = await apiClient.post<{
        data: { checkoutUrl: string };
    }>('/api/payments/checkout-session', { planCode });
    return data.data;
}

export async function createPortalSession(): Promise<{
    portalUrl: string;
}> {
    const { data } = await apiClient.post<{
        data: { portalUrl: string };
    }>('/api/payments/portal-session');
    return data.data;
}
