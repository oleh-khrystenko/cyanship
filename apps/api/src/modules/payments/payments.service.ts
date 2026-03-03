import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    BILLING_EVENT_TYPE,
    RESPONSE_CODE,
    SUBSCRIPTION_STATUS,
    type BillingWebhookEvent,
} from '@lucidkit/types';
import { ENV } from '../../config/env';
import {
    PAYMENT_PROVIDER,
    IPaymentProvider,
} from './interfaces/payment-provider.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
    ProcessedWebhookEvent,
    ProcessedWebhookEventDocument,
} from './schemas/processed-webhook-event.schema';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        @Inject(PAYMENT_PROVIDER)
        private readonly paymentProvider: IPaymentProvider,

        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,

        @InjectModel(ProcessedWebhookEvent.name)
        private readonly webhookEventModel: Model<ProcessedWebhookEventDocument>,
    ) {}

    async createCheckoutSession(
        userId: string,
        planCode: string,
    ): Promise<{ checkoutUrl: string }> {
        const user = await this.userModel.findById(userId).lean();
        if (!user) {
            throw new BadRequestException('User not found');
        }

        if (user.billing?.hasActiveSubscription) {
            throw new ConflictException({
                code: RESPONSE_CODE.ALREADY_SUBSCRIBED,
                message: 'Already subscribed',
            });
        }

        const result = await this.paymentProvider.createCheckoutSession({
            userId,
            userEmail: user.email,
            planCode,
            successUrl: ENV.BILLING_SUCCESS_URL,
            cancelUrl: ENV.BILLING_CANCEL_URL,
        });

        return { checkoutUrl: result.checkoutUrl };
    }

    async createPortalSession(
        userId: string,
    ): Promise<{ portalUrl: string }> {
        const user = await this.userModel.findById(userId).lean();
        if (!user) {
            throw new BadRequestException('User not found');
        }

        if (!user.billing?.providerCustomerId) {
            throw new BadRequestException({
                code: RESPONSE_CODE.NO_BILLING_ACCOUNT,
                message: 'No billing account',
            });
        }

        const result = await this.paymentProvider.createPortalSession(
            user.billing.providerCustomerId,
        );

        return { portalUrl: result.portalUrl };
    }

    async handleWebhook(
        provider: string,
        rawBody: Buffer,
        signatureHeader: string,
    ): Promise<void> {
        // 1. Parse and verify webhook payload
        const event = this.paymentProvider.handleWebhookPayload(
            rawBody,
            signatureHeader,
        );
        if (!event) {
            return;
        }

        // 2. Resolve userId
        const userId = await this.resolveUserId(event);
        if (!userId) {
            this.logger.warn(
                `Cannot resolve userId for webhook event ${event.providerEventId}`,
            );
            return;
        }

        // 3. Idempotency: insert into processed_webhook_events
        const isDuplicate = await this.insertWebhookEvent(
            provider,
            event,
            userId,
        );
        if (isDuplicate) {
            return;
        }

        // 4. Find user
        const user = await this.userModel.findById(userId).lean();
        if (!user) {
            this.logger.warn(
                `User ${userId} not found for webhook event ${event.providerEventId}`,
            );
            return;
        }

        // 5. Out-of-order check (strict < to allow same-second events through)
        if (
            user.billing?.lastProviderEventAt &&
            event.occurredAt < user.billing.lastProviderEventAt
        ) {
            this.logger.debug(
                `Skipping stale event ${event.providerEventId} for user ${userId}`,
            );
            return;
        }

        // 6-8. Apply billing state update
        const billingUpdate = this.buildBillingUpdate(event, user);
        await this.userModel.findByIdAndUpdate(userId, {
            $set: billingUpdate,
        });

        this.logger.log(
            `Processed ${event.type} for user ${userId} (event: ${event.providerEventId})`,
        );
    }

    private async resolveUserId(
        event: BillingWebhookEvent,
    ): Promise<string | null> {
        if (event.userId.length > 0) {
            return event.userId;
        }

        // For subscription events, look up user by providerSubscriptionId
        const subscriptionId = (
            event.raw as Record<string, unknown>
        )?.id as string | undefined;

        if (!subscriptionId) {
            return null;
        }

        const user = await this.userModel
            .findOne({ 'billing.providerSubscriptionId': subscriptionId })
            .lean();

        return user?._id?.toString() ?? null;
    }

    private async insertWebhookEvent(
        provider: string,
        event: BillingWebhookEvent,
        userId: string,
    ): Promise<boolean> {
        try {
            await this.webhookEventModel.create({
                provider,
                providerEventId: event.providerEventId,
                receivedAt: new Date(),
                occurredAt: event.occurredAt,
                type: event.type,
                userId,
            });
            return false;
        } catch (error: unknown) {
            // Duplicate key error (MongoDB code 11000)
            if (
                error instanceof Error &&
                'code' in error &&
                (error as { code: number }).code === 11000
            ) {
                this.logger.debug(
                    `Duplicate webhook event ${event.providerEventId}, skipping`,
                );
                return true;
            }
            throw error;
        }
    }

    private buildBillingUpdate(
        event: BillingWebhookEvent,
        user: User & { _id: unknown },
    ): Record<string, unknown> {
        const hasActive =
            event.subscriptionStatus === SUBSCRIPTION_STATUS.ACTIVE ||
            event.subscriptionStatus === SUBSCRIPTION_STATUS.TRIALING;

        const base: Record<string, unknown> = {
            'billing.subscriptionStatus': event.subscriptionStatus,
            'billing.hasActiveSubscription': hasActive,
            'billing.lastProviderEventAt': event.occurredAt,
            'billing.cancelAtPeriodEnd': event.cancelAtPeriodEnd,
        };

        if (event.currentPeriodEnd) {
            base['billing.currentPeriodEnd'] = event.currentPeriodEnd;
        }

        switch (event.type) {
            case BILLING_EVENT_TYPE.CHECKOUT_COMPLETED: {
                const raw = event.raw as Record<string, unknown>;
                const metadata = raw.metadata as Record<string, string> | undefined;
                base['billing.provider'] = 'stripe';
                base['billing.providerCustomerId'] =
                    (raw.customer as string) ?? null;
                base['billing.providerSubscriptionId'] =
                    (raw.subscription as string) ?? null;
                base['billing.planCode'] =
                    metadata?.planCode ?? null;
                base['billing.currency'] =
                    (raw.currency as string) ?? null;
                base['billing.providerSubscriptionStatus'] =
                    (raw.status as string) ?? null;
                break;
            }

            case BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED: {
                const raw = event.raw as Record<string, unknown>;
                base['billing.providerSubscriptionStatus'] =
                    (raw.status as string) ?? null;
                break;
            }

            case BILLING_EVENT_TYPE.SUBSCRIPTION_DELETED: {
                base['billing.subscriptionStatus'] =
                    SUBSCRIPTION_STATUS.CANCELED;
                base['billing.hasActiveSubscription'] = false;
                base['billing.providerSubscriptionStatus'] = 'canceled';
                break;
            }
        }

        return base;
    }
}
