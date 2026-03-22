import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Stripe from 'stripe';
import Redis from 'ioredis';
import type {
    PaymentsCatalog,
    SubscriptionPlanItem,
    ExecutionPackItem,
} from '@cyanship/types';
import { ENV } from '../../config/env';
import { REDIS_CLIENT } from '../../common/providers/redis.provider';

const CACHE_KEY = 'payments:catalog';
const CACHE_TTL_SEC = 300; // 5 minutes

@Injectable()
export class CatalogService implements OnModuleInit {
    private readonly stripe: Stripe;
    private readonly logger = new Logger(CatalogService.name);

    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) {
        this.stripe = new Stripe(ENV.STRIPE_SECRET_KEY, {
            apiVersion: '2026-02-25.clover',
        });
    }

    /** Warm cache on startup (fail-fast if Stripe unreachable). */
    async onModuleInit(): Promise<void> {
        await this.refreshCatalog();
        this.logger.log('Catalog cache warmed from Stripe');
    }

    /** Returns catalog from Redis cache, falling back to Stripe on cache miss. */
    async getCatalog(): Promise<PaymentsCatalog> {
        const cached = await this.redis.get(CACHE_KEY);
        if (cached) {
            return JSON.parse(cached) as PaymentsCatalog;
        }

        return this.refreshCatalog();
    }

    /** Forces a fresh fetch from Stripe and updates the Redis cache. */
    async refreshCatalog(): Promise<PaymentsCatalog> {
        const catalog = await this.fetchFromStripe();
        await this.redis.set(
            CACHE_KEY,
            JSON.stringify(catalog),
            'EX',
            CACHE_TTL_SEC,
        );
        return catalog;
    }

    /** Returns a subscription plan by code, or undefined if not found. */
    async getSubscriptionPlan(
        code: string,
    ): Promise<SubscriptionPlanItem | undefined> {
        const catalog = await this.getCatalog();
        return catalog.subscriptionPlans.find((p) => p.code === code);
    }

    /** Returns an execution pack by code, or undefined if not found. */
    async getExecutionPack(
        code: string,
    ): Promise<ExecutionPackItem | undefined> {
        const catalog = await this.getCatalog();
        return catalog.executionPacks.find((p) => p.code === code);
    }

    /** Returns a reverse lookup map: Stripe priceId → plan code. */
    async getPriceToPlanMap(): Promise<Record<string, string>> {
        const catalog = await this.getCatalog();
        const map: Record<string, string> = {};
        for (const plan of catalog.subscriptionPlans) {
            map[plan.priceId] = plan.code;
        }
        return map;
    }

    private async fetchFromStripe(): Promise<PaymentsCatalog> {
        const products = await this.stripe.products.list({
            active: true,
            expand: ['data.default_price'],
        });

        const subscriptionPlans: SubscriptionPlanItem[] = [];
        const executionPacks: ExecutionPackItem[] = [];

        for (const product of products.data) {
            const meta = product.metadata;
            const purchaseType = meta.purchase_type;
            const code = meta.code;

            if (!code || !purchaseType) continue;

            const price = product.default_price as Stripe.Price | null;
            if (!price || !price.unit_amount) continue;

            const executions = parseInt(meta.executions ?? '0', 10);
            const displayOrder = parseInt(meta.display_order ?? '0', 10);
            const featured = meta.featured === 'true';

            if (purchaseType === 'subscription') {
                subscriptionPlans.push({
                    code,
                    priceId: price.id,
                    priceAmount: price.unit_amount,
                    currency: price.currency,
                    interval: price.recurring?.interval ?? 'month',
                    executions,
                    displayOrder,
                    featured,
                });
            } else if (purchaseType === 'executions_pack') {
                executionPacks.push({
                    code,
                    priceId: price.id,
                    priceAmount: price.unit_amount,
                    currency: price.currency,
                    executions,
                    displayOrder,
                    featured,
                });
            }
        }

        subscriptionPlans.sort((a, b) => a.displayOrder - b.displayOrder);
        executionPacks.sort((a, b) => a.displayOrder - b.displayOrder);

        return { subscriptionPlans, executionPacks };
    }
}
