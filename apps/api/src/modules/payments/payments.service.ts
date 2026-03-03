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
    PAYMENT_TYPE,
    RESPONSE_CODE,
    SUBSCRIPTION_STATUS,
    type BillingWebhookEvent,
    type CreateCheckoutSession,
} from '@lucidkit/types';
import { ENV, STRIPE_CREDIT_PACKS } from '../../config/env';
import {
    PAYMENT_PROVIDER,
    IPaymentProvider,
} from './interfaces/payment-provider.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
    ProcessedWebhookEvent,
    ProcessedWebhookEventDocument,
} from './schemas/processed-webhook-event.schema';
import { UsersService } from '../users/users.service';

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

        private readonly usersService: UsersService,
    ) {}

    async createCheckoutSession(
        userId: string,
        dto: CreateCheckoutSession,
    ): Promise<{ checkoutUrl: string }> {
        const { paymentType, planCode, packCode } = dto;

        // Feature flag check
        if (
            paymentType === PAYMENT_TYPE.SUBSCRIPTION &&
            !ENV.PAYMENTS_SUBSCRIPTION_ENABLED
        ) {
            throw new BadRequestException({
                code: RESPONSE_CODE.PAYMENT_TYPE_DISABLED,
                message: 'Subscription payments are disabled',
            });
        }
        if (
            paymentType === PAYMENT_TYPE.ONE_OFF &&
            !ENV.PAYMENTS_ONE_OFF_ENABLED
        ) {
            throw new BadRequestException({
                code: RESPONSE_CODE.PAYMENT_TYPE_DISABLED,
                message: 'One-off payments are disabled',
            });
        }

        const user = await this.userModel.findById(userId).lean();
        if (!user) {
            throw new BadRequestException('User not found');
        }

        // Subscription-specific validation
        if (paymentType === PAYMENT_TYPE.SUBSCRIPTION) {
            if (user.billing?.hasActiveSubscription) {
                throw new ConflictException({
                    code: RESPONSE_CODE.ALREADY_SUBSCRIBED,
                    message: 'Already subscribed',
                });
            }
            const priceId = ENV.STRIPE_PRICE_MONTHLY_USD;
            const result =
                await this.paymentProvider.createCheckoutSession({
                    userId,
                    userEmail: user.email,
                    providerCustomerId:
                        user.billing?.providerCustomerId ?? undefined,
                    paymentType,
                    planCode: planCode!,
                    priceId,
                    successUrl: ENV.BILLING_SUCCESS_URL,
                    cancelUrl: ENV.BILLING_CANCEL_URL,
                });
            return { checkoutUrl: result.checkoutUrl };
        }

        // One-off payment
        const pack = packCode ? STRIPE_CREDIT_PACKS[packCode] : undefined;
        if (!pack) {
            throw new BadRequestException('Invalid packCode');
        }
        const result = await this.paymentProvider.createCheckoutSession({
            userId,
            userEmail: user.email,
            providerCustomerId:
                user.billing?.providerCustomerId ?? undefined,
            paymentType,
            planCode: packCode!,
            priceId: pack.priceId,
            credits: pack.credits,
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

        // 5. Out-of-order check (тільки для subscription events)
        // One-off платежі незалежні один від одного, order не важливий
        if (
            event.type !== BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED &&
            user.billing?.lastProviderEventAt &&
            event.occurredAt < user.billing.lastProviderEventAt
        ) {
            this.logger.debug(
                `Skipping stale event ${event.providerEventId} for user ${userId}`,
            );
            return;
        }

        // 6. Apply event
        if (event.type === BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED) {
            await this.applyOneOffPayment(userId, event);
        } else {
            const billingFields = this.buildBillingUpdate(event, user);
            const dotNotation: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(billingFields)) {
                dotNotation[`billing.${key}`] = value;
            }
            await this.userModel.findByIdAndUpdate(userId, {
                $set: dotNotation,
            });
        }

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

    private async applyOneOffPayment(
        userId: string,
        event: BillingWebhookEvent,
    ): Promise<void> {
        const credits = event.creditsAmount ?? 0;
        if (!Number.isFinite(credits) || credits <= 0) {
            this.logger.warn(
                `ONE_OFF_PAYMENT_COMPLETED event ${event.providerEventId} has no creditsAmount`,
            );
            return;
        }
        await this.usersService.addCredits(userId, credits);
        this.logger.log(
            `Added ${credits} credits to user ${userId} (event: ${event.providerEventId})`,
        );
    }

    private buildBillingUpdate(
        event: BillingWebhookEvent,
        user: User & { _id: unknown },
    ): Record<string, unknown> {
        const status =
            event.subscriptionStatus ?? SUBSCRIPTION_STATUS.UNKNOWN;
        const hasActive =
            status === SUBSCRIPTION_STATUS.ACTIVE ||
            status === SUBSCRIPTION_STATUS.TRIALING;

        const fields: Record<string, unknown> = {
            subscriptionStatus: status,
            hasActiveSubscription: hasActive,
            lastProviderEventAt: event.occurredAt,
            cancelAtPeriodEnd: event.cancelAtPeriodEnd ?? false,
        };

        if (event.currentPeriodEnd) {
            fields['currentPeriodEnd'] = event.currentPeriodEnd;
        }

        switch (event.type) {
            case BILLING_EVENT_TYPE.CHECKOUT_COMPLETED: {
                const raw = event.raw as Record<string, unknown>;
                const metadata = raw.metadata as Record<string, string> | undefined;
                fields['provider'] = 'stripe';
                fields['providerCustomerId'] = (raw.customer as string) ?? null;
                fields['providerSubscriptionId'] = (raw.subscription as string) ?? null;
                fields['planCode'] = metadata?.planCode ?? null;
                fields['currency'] = (raw.currency as string) ?? null;
                fields['providerSubscriptionStatus'] = (raw.status as string) ?? null;
                break;
            }

            case BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED: {
                const raw = event.raw as Record<string, unknown>;
                fields['providerSubscriptionStatus'] = (raw.status as string) ?? null;
                break;
            }

            case BILLING_EVENT_TYPE.SUBSCRIPTION_DELETED: {
                fields['subscriptionStatus'] = SUBSCRIPTION_STATUS.CANCELED;
                fields['hasActiveSubscription'] = false;
                fields['providerSubscriptionStatus'] = 'canceled';
                break;
            }
        }

        return fields;
    }
}
