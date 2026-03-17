import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
    BillingWebhookEvent,
    BILLING_EVENT_TYPE,
    PAYMENT_TYPE,
    SUBSCRIPTION_STATUS,
    type SubscriptionStatus,
} from '@cyanship/types';
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
        input: CreateCheckoutInput
    ): Promise<CheckoutResult> {
        const mode =
            input.paymentType === PAYMENT_TYPE.ONE_OFF
                ? 'payment'
                : 'subscription';

        const session = await this.stripe.checkout.sessions.create({
            mode,
            ...(input.providerCustomerId
                ? { customer: input.providerCustomerId }
                : { customer_email: input.userEmail }),
            line_items: [{ price: input.priceId, quantity: 1 }],
            metadata: {
                userId: input.userId,
                planCode: input.planCode,
                credits: String(input.credits ?? 0),
            },
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
        returnUrl: string
    ): Promise<PortalResult> {
        const session = await this.stripe.billingPortal.sessions.create({
            customer: providerCustomerId,
            return_url: returnUrl,
        });

        return { portalUrl: session.url };
    }

    handleWebhookPayload(
        rawBody: Buffer,
        signatureHeader: string
    ): BillingWebhookEvent | null {
        const event = this.stripe.webhooks.constructEvent(
            rawBody,
            signatureHeader,
            ENV.STRIPE_WEBHOOK_SECRET
        );

        switch (event.type) {
            case 'checkout.session.completed':
            case 'checkout.session.async_payment_succeeded':
                return this.handleCheckoutCompleted(event);
            case 'customer.subscription.updated':
                return this.handleSubscriptionEvent(
                    event,
                    BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED
                );
            case 'customer.subscription.deleted':
                return this.handleSubscriptionEvent(
                    event,
                    BILLING_EVENT_TYPE.SUBSCRIPTION_DELETED
                );
            default:
                this.logger.debug(`Ignoring Stripe event: ${event.type}`);
                return null;
        }
    }

    private handleCheckoutCompleted(
        event: Stripe.Event
    ): BillingWebhookEvent | null {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
            session.metadata?.userId || session.client_reference_id || '';

        // One-off payment (mode=payment, paid)
        if (session.mode === 'payment' && session.payment_status === 'paid') {
            const credits = parseInt(session.metadata?.credits ?? '0', 10);
            return {
                type: BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED,
                providerEventId: event.id,
                occurredAt: new Date(event.created * 1000),
                userId,
                creditsAmount: credits,
                packCode: session.metadata?.planCode || undefined,
                raw: this.toRaw(event.data.object),
            };
        }

        // Subscription checkout (mode=subscription)
        if (session.mode === 'subscription') {
            const credits = parseInt(session.metadata?.credits ?? '0', 10);
            return {
                type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
                providerEventId: event.id,
                occurredAt: new Date(event.created * 1000),
                userId,
                subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                creditsAmount: credits || undefined,
                raw: this.toRaw(event.data.object),
            };
        }

        // Unexpected mode/status — e.g. async payment not yet paid
        this.logger.debug(
            `Ignoring checkout.session.completed with mode=${session.mode} payment_status=${session.payment_status}`
        );
        return null;
    }

    private handleSubscriptionEvent(
        event: Stripe.Event,
        type:
            | typeof BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED
            | typeof BILLING_EVENT_TYPE.SUBSCRIPTION_DELETED
    ): BillingWebhookEvent {
        const subscription = event.data.object as Stripe.Subscription;
        const periodEnd =
            subscription.items?.data?.[0]?.current_period_end ?? null;

        return {
            type,
            providerEventId: event.id,
            occurredAt: new Date(event.created * 1000),
            userId: '',
            subscriptionStatus: this.mapSubscriptionStatus(subscription.status),
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
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
        return JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
    }
}
