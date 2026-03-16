import { BillingWebhookEvent, PaymentType } from '@cyanship/types';

export interface CreateCheckoutInput {
    userId: string;
    userEmail: string;
    providerCustomerId?: string;
    paymentType: PaymentType;
    planCode: string;
    priceId: string;
    credits?: number;
    successUrl: string;
    cancelUrl: string;
}

export interface CheckoutResult {
    checkoutUrl: string;
    providerSessionId: string;
}

export interface PortalResult {
    portalUrl: string;
}

export interface IPaymentProvider {
    createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutResult>;
    createPortalSession(providerCustomerId: string): Promise<PortalResult>;
    handleWebhookPayload(
        rawBody: Buffer,
        signatureHeader: string
    ): BillingWebhookEvent | null;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
