import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
    BillingWebhookEvent,
    BILLING_EVENT_TYPE,
    SUBSCRIPTION_STATUS,
    type SubscriptionStatus,
} from '@lucidkit/types';
import { ENV } from '../../../config/env';
import {
    IPaymentProvider,
    CreateCheckoutInput,
    CheckoutResult,
    PortalResult,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class StripeService implements IPaymentProvider {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(StripeService.name);

    constructor() {
        this.stripe = new Stripe(ENV.STRIPE_SECRET_KEY, {
            apiVersion: '2026-02-25.clover',
        });
    }

    async createCheckoutSession(
        input: CreateCheckoutInput,
    ): Promise<CheckoutResult> {
        const session = await this.stripe.checkout.sessions.create({
            mode: 'subscription',
            customer_email: input.userEmail,
            line_items: [
                { price: ENV.STRIPE_PRICE_ONE_OFF_USD, quantity: 1 },
            ],
            metadata: { userId: input.userId, planCode: input.planCode },
            client_reference_id: input.userId,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
        });

        if (!session.url) {
            throw new Error('Stripe checkout session created without URL');
        }

        return {
            checkoutUrl: session.url,
            providerSessionId: session.id,
        };
    }

    async createPortalSession(
        providerCustomerId: string,
    ): Promise<PortalResult> {
        const session = await this.stripe.billingPortal.sessions.create({
            customer: providerCustomerId,
            return_url: ENV.BILLING_SUCCESS_URL,
        });

        return { portalUrl: session.url };
    }

    handleWebhookPayload(
        rawBody: Buffer,
        signatureHeader: string,
    ): BillingWebhookEvent | null {
        const event = this.stripe.webhooks.constructEvent(
            rawBody,
            signatureHeader,
            ENV.STRIPE_WEBHOOK_SECRET,
        );

        switch (event.type) {
            case 'checkout.session.completed':
                return this.handleCheckoutCompleted(event);
            case 'customer.subscription.updated':
                return this.handleSubscriptionEvent(
                    event,
                    BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED,
                );
            case 'customer.subscription.deleted':
                return this.handleSubscriptionEvent(
                    event,
                    BILLING_EVENT_TYPE.SUBSCRIPTION_DELETED,
                );
            default:
                this.logger.debug(`Ignoring Stripe event: ${event.type}`);
                return null;
        }
    }

    private handleCheckoutCompleted(
        event: Stripe.Event,
    ): BillingWebhookEvent {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
            session.metadata?.userId ||
            session.client_reference_id ||
            '';

        return {
            type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
            providerEventId: event.id,
            occurredAt: new Date(event.created * 1000),
            userId,
            // Checkout session doesn't carry subscription status;
            // the follow-up customer.subscription.updated event will set the real value.
            subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            raw: this.toRaw(event.data.object),
        };
    }

    private handleSubscriptionEvent(
        event: Stripe.Event,
        type: typeof BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED | typeof BILLING_EVENT_TYPE.SUBSCRIPTION_DELETED,
    ): BillingWebhookEvent {
        const subscription = event.data.object as Stripe.Subscription;
        const periodEnd =
            subscription.items?.data?.[0]?.current_period_end ?? null;

        return {
            type,
            providerEventId: event.id,
            occurredAt: new Date(event.created * 1000),
            userId: '',
            subscriptionStatus: this.mapSubscriptionStatus(
                subscription.status,
            ),
            currentPeriodEnd: periodEnd
                ? new Date(periodEnd * 1000)
                : null,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            raw: this.toRaw(event.data.object),
        };
    }

    private mapSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
        const mapping: Record<string, SubscriptionStatus> = {
            active: SUBSCRIPTION_STATUS.ACTIVE,
            trialing: SUBSCRIPTION_STATUS.TRIALING,
            past_due: SUBSCRIPTION_STATUS.PAST_DUE,
            canceled: SUBSCRIPTION_STATUS.CANCELED,
            incomplete: SUBSCRIPTION_STATUS.INCOMPLETE,
            unpaid: SUBSCRIPTION_STATUS.UNPAID,
            incomplete_expired: SUBSCRIPTION_STATUS.CANCELED,
            paused: SUBSCRIPTION_STATUS.UNKNOWN,
        };
        return mapping[stripeStatus] ?? SUBSCRIPTION_STATUS.UNKNOWN;
    }

    private toRaw(obj: object): Record<string, unknown> {
        return JSON.parse(JSON.stringify(obj));
    }
}
