import { apiClient } from './client';
import {
    PAYMENT_TYPE,
    type SubscriptionPlanCode,
    type ExecutionPackCode,
} from '@cyanship/types';

export async function createSubscriptionCheckout(
    planCode: SubscriptionPlanCode,
): Promise<{ checkoutUrl: string }> {
    const { data } = await apiClient.post<{
        data: { checkoutUrl: string };
    }>('/payments/checkout-session', {
        paymentType: PAYMENT_TYPE.SUBSCRIPTION,
        planCode,
    });
    return data.data;
}

export async function createOneOffCheckout(
    packCode: ExecutionPackCode,
): Promise<{ checkoutUrl: string }> {
    const { data } = await apiClient.post<{
        data: { checkoutUrl: string };
    }>('/payments/checkout-session', {
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
    }>('/payments/portal-session');
    return data.data;
}

export async function resetBilling(): Promise<void> {
    await apiClient.post('/payments/reset');
}
