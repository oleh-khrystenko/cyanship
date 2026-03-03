import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as cookieParser from 'cookie-parser';
import * as supertest from 'supertest';
import { App } from 'supertest/types';
import { ZodValidationPipe } from 'nestjs-zod';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import {
    BILLING_EVENT_TYPE,
    SUBSCRIPTION_STATUS,
    type BillingWebhookEvent,
} from '@lucidkit/types';

import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { REDIS_CLIENT } from '../src/common/providers/redis.provider';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { ReportsModule } from '../src/modules/reports/reports.module';
import { StorageModule } from '../src/modules/storage/storage.module';
import { PaymentsModule } from '../src/modules/payments/payments.module';
import {
    User,
    UserDocument,
} from '../src/modules/users/schemas/user.schema';
import {
    ProcessedWebhookEvent,
    ProcessedWebhookEventDocument,
} from '../src/modules/payments/schemas/processed-webhook-event.schema';
import { EmailService } from '../src/modules/auth/services/email.service';
import { PAYMENT_PROVIDER } from '../src/modules/payments/interfaces/payment-provider.interface';

// ─── Mock ENV ────────────────────────────────────────────────────────────────

jest.mock('../src/config/env', () => ({
    ENV: {
        NODE_ENV: 'test',
        PORT: '4000',
        WEB_URL: 'http://localhost:3000',
        MONGODB_URI: 'overridden-by-MongoMemoryServer',
        REDIS_URL: 'redis://mock',
        JWT_ACCESS_SECRET: 'e2e-test-access-secret-must-be-long-enough',
        JWT_REFRESH_SECRET: 'e2e-test-refresh-secret-must-be-long-enough',
        GOOGLE_CLIENT_ID: 'test-id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'GOCSPX-test-secret',
        GOOGLE_CALLBACK_URL: 'http://localhost:4000/api/auth/google/callback',
        RESEND_API_KEY: 're_test_key',
        RESEND_FROM_EMAIL: 'LucidKit <test@test.com>',
        AUTH_LOCKOUT_THRESHOLDS: '5:1,10:5,20:15',
        AUTH_LOGIN_ATTEMPTS_TTL_MIN: 15,
        AUTH_MAGIC_LINK_TTL_MIN: 15,
        AUTH_MAGIC_LINK_RATE_LIMIT: 3,
        AUTH_MAGIC_LINK_RATE_WINDOW_MIN: 15,
        AUTH_MAGIC_LINK_DEDUP_SEC: 60,
        ACCOUNT_DELETION_GRACE_DAYS: 30,
        AUTH_PASSWORD_MIN_LENGTH: 8,
        STRIPE_SECRET_KEY: 'sk_test_payments_e2e',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
        STRIPE_PRICE_MONTHLY_USD: 'price_test_monthly',
        BILLING_SUCCESS_URL: 'http://localhost:3000/billing/success',
        BILLING_CANCEL_URL: 'http://localhost:3000/billing/cancel',
    },
    parseLockoutThresholds: (raw: string) =>
        raw.split(',').map((entry: string) => {
            const [attempts, blockMin] = entry.split(':').map(Number);
            return { attempts, blockMin };
        }),
}));

// ─── Stateful Redis mock ──────────────────────────────────────────────────────

function createStatefulRedisMock() {
    const store = new Map<string, string>();

    function createPipeline() {
        const ops: Array<() => void> = [];
        const pipe = {
            set(key: string, value: string) {
                ops.push(() => store.set(key, value));
                return pipe;
            },
            del(key: string) {
                ops.push(() => store.delete(key));
                return pipe;
            },
            incr(key: string) {
                ops.push(() => {
                    const val = store.get(key);
                    store.set(key, String((parseInt(val ?? '0', 10) || 0) + 1));
                });
                return pipe;
            },
            expire(_key: string, _ttl: number) {
                return pipe;
            },
            sadd(key: string, ...members: string[]) {
                ops.push(() => {
                    const existing = store.get(key);
                    const set: Set<string> = existing
                        ? new Set(JSON.parse(existing) as string[])
                        : new Set<string>();
                    for (const m of members) set.add(m);
                    store.set(key, JSON.stringify([...set]));
                });
                return pipe;
            },
            srem(key: string, ...members: string[]) {
                ops.push(() => {
                    const existing = store.get(key);
                    if (!existing) return;
                    const set: Set<string> = new Set(
                        JSON.parse(existing) as string[],
                    );
                    for (const m of members) set.delete(m);
                    if (set.size === 0) store.delete(key);
                    else store.set(key, JSON.stringify([...set]));
                });
                return pipe;
            },
            async exec() {
                for (const op of ops) op();
                return [];
            },
        };
        return pipe;
    }

    return {
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue('OK'),
        on: jest.fn().mockReturnThis(),
        async get(key: string) {
            return store.get(key) ?? null;
        },
        async getdel(key: string) {
            const val = store.get(key) ?? null;
            if (val !== null) store.delete(key);
            return val;
        },
        async set(key: string, value: string) {
            store.set(key, value);
            return 'OK';
        },
        async del(key: string) {
            store.delete(key);
            return 1;
        },
        async incr(key: string) {
            const current = parseInt(store.get(key) ?? '0', 10) || 0;
            const next = current + 1;
            store.set(key, String(next));
            return next;
        },
        async expire(_key: string, _ttl: number) {
            return 1;
        },
        async smembers(key: string) {
            const val = store.get(key);
            if (!val) return [];
            return JSON.parse(val) as string[];
        },
        async srem(key: string, ...members: string[]) {
            const val = store.get(key);
            if (!val) return 0;
            const set = new Set(JSON.parse(val) as string[]);
            let removed = 0;
            for (const m of members) {
                if (set.delete(m)) removed++;
            }
            if (set.size === 0) store.delete(key);
            else store.set(key, JSON.stringify([...set]));
            return removed;
        },
        pipeline() {
            return createPipeline();
        },
        _store: store,
        _clear() {
            store.clear();
        },
    };
}

// ─── Mock dependencies ────────────────────────────────────────────────────────

const mockEmailService = {
    sendMagicLink: jest.fn().mockResolvedValue(undefined),
    sendDeletionConfirmation: jest.fn().mockResolvedValue(undefined),
};

const mockPaymentProvider = {
    createCheckoutSession: jest.fn(),
    createPortalSession: jest.fn(),
    handleWebhookPayload: jest.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('Payments E2E', () => {
    let app: INestApplication<App>;
    let mongoServer: MongoMemoryServer;
    let userModel: Model<UserDocument>;
    let webhookEventModel: Model<ProcessedWebhookEventDocument>;
    let redisMock: ReturnType<typeof createStatefulRedisMock>;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        redisMock = createStatefulRedisMock();

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                ThrottlerModule.forRoot({
                    throttlers: [{ ttl: 60000, limit: 600 }],
                }),
                MongooseModule.forRoot(mongoServer.getUri()),
                AuthModule,
                UsersModule,
                ReportsModule,
                StorageModule,
                PaymentsModule,
            ],
            controllers: [AppController],
            providers: [
                AppService,
                { provide: APP_GUARD, useClass: ThrottlerGuard },
            ],
        })
            .overrideProvider(REDIS_CLIENT)
            .useValue(redisMock)
            .overrideProvider(EmailService)
            .useValue(mockEmailService)
            .overrideProvider(PAYMENT_PROVIDER)
            .useValue(mockPaymentProvider)
            .compile();

        app = moduleFixture.createNestApplication({ rawBody: true });
        app.use(cookieParser());
        app.setGlobalPrefix('api');
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new AllExceptionsFilter());
        await app.init();

        userModel = moduleFixture.get<Model<UserDocument>>(
            getModelToken(User.name),
        );
        webhookEventModel = moduleFixture.get<
            Model<ProcessedWebhookEventDocument>
        >(getModelToken(ProcessedWebhookEvent.name));
    }, 60_000);

    afterAll(async () => {
        await app.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        redisMock._clear();
        await userModel.deleteMany({});
        await webhookEventModel.deleteMany({});

        // Default mock responses
        mockPaymentProvider.handleWebhookPayload.mockReturnValue(null);
        mockPaymentProvider.createCheckoutSession.mockResolvedValue({
            checkoutUrl: 'https://checkout.stripe.com/test_session',
            providerSessionId: 'cs_test_xxx',
        });
        mockPaymentProvider.createPortalSession.mockResolvedValue({
            portalUrl: 'https://billing.stripe.com/test_session',
        });
        mockEmailService.sendMagicLink.mockClear();
        mockEmailService.sendDeletionConfirmation.mockClear();
    });

    // ─── Helpers ─────────────────────────────────────────────────────

    const TEST_PASSWORD = 'TestPass123!';

    async function createUser(
        email: string,
        billingData?: Record<string, unknown> | null,
    ): Promise<UserDocument> {
        const hash = await bcrypt.hash(TEST_PASSWORD, 10);
        return userModel.create({
            email: email.toLowerCase(),
            passwordHash: hash,
            profile: { name: 'Test User' },
            credits: { balance: 0, freeReportUsed: false },
            billing: billingData ?? null,
        });
    }

    async function loginAsUser(
        email: string,
    ): Promise<{ accessToken: string }> {
        const res = await supertest(app.getHttpServer())
            .post('/api/auth/login/password')
            .send({ email, password: TEST_PASSWORD })
            .expect(201);

        const body = res.body as { data: { accessToken: string } };
        return { accessToken: body.data.accessToken };
    }

    // ─── A. POST /api/payments/checkout-session ───────────────────────

    describe('POST /api/payments/checkout-session', () => {
        it('should return 201 with checkoutUrl for authorized user without active subscription', async () => {
            await createUser('checkout@example.com', null);
            const { accessToken } = await loginAsUser('checkout@example.com');

            await supertest(app.getHttpServer())
                .post('/api/payments/checkout-session')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ planCode: 'monthly_usd' })
                .expect(201)
                .expect((res: supertest.Response) => {
                    expect(
                        (res.body as { data: { checkoutUrl: string } }).data
                            .checkoutUrl,
                    ).toBe('https://checkout.stripe.com/test_session');
                });
        });

        it('should return 409 ALREADY_SUBSCRIBED when user has active subscription', async () => {
            await createUser('subscribed@example.com', {
                hasActiveSubscription: true,
                providerCustomerId: 'cus_existing',
            });
            const { accessToken } = await loginAsUser('subscribed@example.com');

            await supertest(app.getHttpServer())
                .post('/api/payments/checkout-session')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ planCode: 'monthly_usd' })
                .expect(409)
                .expect((res: supertest.Response) => {
                    expect(
                        (res.body as { error: { code: string } }).error.code,
                    ).toBe('ALREADY_SUBSCRIBED');
                });
        });

        it('should return 401 when JWT token is missing', async () => {
            await supertest(app.getHttpServer())
                .post('/api/payments/checkout-session')
                .send({ planCode: 'monthly_usd' })
                .expect(401);
        });

        it('should return 400 when planCode is missing from body', async () => {
            await createUser('noplan@example.com', null);
            const { accessToken } = await loginAsUser('noplan@example.com');

            await supertest(app.getHttpServer())
                .post('/api/payments/checkout-session')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({})
                .expect(400);
        });

        it('should return 400 when planCode is empty string', async () => {
            await createUser('emptyplan@example.com', null);
            const { accessToken } = await loginAsUser('emptyplan@example.com');

            await supertest(app.getHttpServer())
                .post('/api/payments/checkout-session')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ planCode: '' })
                .expect(400);
        });
    });

    // ─── B. POST /api/payments/portal-session ────────────────────────

    describe('POST /api/payments/portal-session', () => {
        it('should return 201 with portalUrl for user with providerCustomerId', async () => {
            await createUser('portal@example.com', {
                providerCustomerId: 'cus_portal_test',
                hasActiveSubscription: true,
            });
            const { accessToken } = await loginAsUser('portal@example.com');

            await supertest(app.getHttpServer())
                .post('/api/payments/portal-session')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(201)
                .expect((res: supertest.Response) => {
                    expect(
                        (res.body as { data: { portalUrl: string } }).data
                            .portalUrl,
                    ).toBe('https://billing.stripe.com/test_session');
                });
        });

        it('should return 400 NO_BILLING_ACCOUNT when billing subdocument is null', async () => {
            await createUser('nobilling@example.com', null);
            const { accessToken } = await loginAsUser('nobilling@example.com');

            await supertest(app.getHttpServer())
                .post('/api/payments/portal-session')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(400)
                .expect((res: supertest.Response) => {
                    expect(
                        (res.body as { error: { code: string } }).error.code,
                    ).toBe('NO_BILLING_ACCOUNT');
                });
        });

        it('should return 400 NO_BILLING_ACCOUNT when providerCustomerId is null', async () => {
            await createUser('nullcustomer@example.com', {
                providerCustomerId: null,
                hasActiveSubscription: false,
            });
            const { accessToken } = await loginAsUser(
                'nullcustomer@example.com',
            );

            await supertest(app.getHttpServer())
                .post('/api/payments/portal-session')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(400)
                .expect((res: supertest.Response) => {
                    expect(
                        (res.body as { error: { code: string } }).error.code,
                    ).toBe('NO_BILLING_ACCOUNT');
                });
        });

        it('should return 401 when JWT token is missing', async () => {
            await supertest(app.getHttpServer())
                .post('/api/payments/portal-session')
                .expect(401);
        });
    });

    // ─── C. POST /api/payments/webhook/:provider ──────────────────────

    describe('POST /api/payments/webhook/:provider', () => {
        it('should return 201 with { received: true } for valid stripe webhook', async () => {
            // mockPaymentProvider.handleWebhookPayload returns null by default (unknown event)
            await supertest(app.getHttpServer())
                .post('/api/payments/webhook/stripe')
                .set('stripe-signature', 'test-sig')
                .set('content-type', 'application/json')
                .send('{}')
                .expect(201)
                .expect({ received: true });
        });

        it('should return 400 when stripe-signature header is missing', async () => {
            await supertest(app.getHttpServer())
                .post('/api/payments/webhook/stripe')
                .set('content-type', 'application/json')
                .send('{}')
                .expect(400)
                .expect((res: supertest.Response) => {
                    expect(
                        (res.body as { error: { code: string } }).error.code,
                    ).toBeDefined();
                });
        });

        it('should return 400 for unsupported provider', async () => {
            await supertest(app.getHttpServer())
                .post('/api/payments/webhook/monobank')
                .set('stripe-signature', 'test-sig')
                .set('content-type', 'application/json')
                .send('{}')
                .expect(400)
                .expect((res: supertest.Response) => {
                    expect(
                        (res.body as { error: { message: string } }).error
                            .message,
                    ).toContain('monobank');
                });
        });
    });

    // ─── D. Response format ───────────────────────────────────────────

    describe('response format', () => {
        it('success response has { data: { ... } } shape', async () => {
            await createUser('format-success@example.com', null);
            const { accessToken } = await loginAsUser(
                'format-success@example.com',
            );

            const res = await supertest(app.getHttpServer())
                .post('/api/payments/checkout-session')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ planCode: 'monthly_usd' })
                .expect(201);

            expect(res.body).toHaveProperty('data');
            expect(
                (res.body as { data: unknown }).data,
            ).toHaveProperty('checkoutUrl');
        });

        it('error response has { error: { code, message } } shape', async () => {
            const res = await supertest(app.getHttpServer())
                .post('/api/payments/checkout-session')
                .send({ planCode: 'monthly_usd' })
                .expect(401);

            const body = res.body as {
                error: { code: string; message: string };
            };
            expect(body).toHaveProperty('error');
            expect(body.error).toHaveProperty('code');
            expect(body.error).toHaveProperty('message');
        });

        it('validation error returns 400 with error format', async () => {
            await createUser('format-validate@example.com', null);
            const { accessToken } = await loginAsUser(
                'format-validate@example.com',
            );

            const res = await supertest(app.getHttpServer())
                .post('/api/payments/checkout-session')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({})
                .expect(400);

            const body = res.body as { error: { code: string } };
            expect(body).toHaveProperty('error');
            expect(body.error).toHaveProperty('code');
        });
    });

    // ─── E. Webhook idempotency ───────────────────────────────────────

    describe('webhook idempotency', () => {
        it('should update billing on first webhook and skip duplicate on second call', async () => {
            const user = await createUser('idempotency@example.com', null);
            const userId = (user._id as object).toString();

            const checkoutEvent: BillingWebhookEvent = {
                type: BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
                providerEventId: 'evt_idempotency_test_001',
                occurredAt: new Date('2024-01-01T00:00:00Z'),
                userId,
                subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                raw: {
                    customer: 'cus_idempotency_test',
                    subscription: 'sub_idempotency_test',
                    currency: 'usd',
                    status: 'complete',
                    metadata: { planCode: 'monthly_usd' },
                },
            };

            mockPaymentProvider.handleWebhookPayload.mockReturnValue(
                checkoutEvent,
            );

            // First webhook — should update billing
            await supertest(app.getHttpServer())
                .post('/api/payments/webhook/stripe')
                .set('stripe-signature', 'test-sig')
                .set('content-type', 'application/json')
                .send('{}')
                .expect(201)
                .expect({ received: true });

            const userAfterFirst = await userModel.findById(userId).lean();
            expect(userAfterFirst?.billing?.hasActiveSubscription).toBe(true);
            expect(userAfterFirst?.billing?.providerCustomerId).toBe(
                'cus_idempotency_test',
            );

            // Second webhook with same providerEventId — idempotent, no duplicate update
            await supertest(app.getHttpServer())
                .post('/api/payments/webhook/stripe')
                .set('stripe-signature', 'test-sig')
                .set('content-type', 'application/json')
                .send('{}')
                .expect(201)
                .expect({ received: true });

            // Event should be recorded only once in the processed_webhook_events collection
            const eventCount = await webhookEventModel.countDocuments({
                providerEventId: 'evt_idempotency_test_001',
            });
            expect(eventCount).toBe(1);
        });
    });
});
