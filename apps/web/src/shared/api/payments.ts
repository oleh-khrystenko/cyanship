import { apiClient } from './client';
import { PAYMENT_TYPE, type CreditPackCode } from '@lucidship/types';

export async function createSubscriptionCheckout(
    planCode: string,
): Promise<{ checkoutUrl: string }> {
    const { data } = await apiClient.post<{
        data: { checkoutUrl: string };
    }>('/api/payments/checkout-session', {
        paymentType: PAYMENT_TYPE.SUBSCRIPTION,
        planCode,
    });
    return data.data;
}

export async function createOneOffCheckout(
    packCode: CreditPackCode,
): Promise<{ checkoutUrl: string }> {
    const { data } = await apiClient.post<{
        data: { checkoutUrl: string };
    }>('/api/payments/checkout-session', {
        paymentType: PAYMENT_TYPE.ONE_OFF,
        packCode,
    });
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
