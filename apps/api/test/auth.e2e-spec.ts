import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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

import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { OnboardingInterceptor } from '../src/common/interceptors/onboarding.interceptor';
import { REDIS_CLIENT } from '../src/common/modules/redis.constants';
import { RedisModule } from '../src/common/modules/redis.module';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { AuthModule } from '../src/modules/auth/auth.module';
import { EmailModule } from '../src/modules/email/email.module';
import { UsersModule } from '../src/modules/users/users.module';
import { ReportsModule } from '../src/modules/reports/reports.module';
import { StorageModule } from '../src/modules/storage/storage.module';
import { PaymentsModule } from '../src/modules/payments/payments.module';
import { User, UserDocument } from '../src/modules/users/schemas/user.schema';
import { EmailService } from '../src/modules/email/email.service';
import { CatalogService } from '../src/modules/payments/catalog.service';
import { CURRENT_TERMS_VERSION } from '@cyanship/types';
import { createStatefulRedisMock } from './utils/redis.mock';
import { createCatalogServiceMock } from './utils/catalog.mock';
import { listenOnLoopback, LOOPBACK_IP } from './utils/listen';

// Env comes from src/test-setup.ts (jest-e2e.json setupFiles) — the real
// fail-fast loader runs against placeholder values, so a newly required var
// breaks the suite immediately instead of silently missing from a hand-written mock.

// ─── Mock EmailService ───

const emailCalls: Array<{
    method: string;
    args: unknown[];
}> = [];

const mockEmailService = {
    sendMagicLink: jest.fn((...args: unknown[]) => {
        emailCalls.push({ method: 'sendMagicLink', args });
        return Promise.resolve();
    }),
    sendDeletionConfirmation: jest.fn((...args: unknown[]) => {
        emailCalls.push({ method: 'sendDeletionConfirmation', args });
        return Promise.resolve();
    }),
};

// ─── Test setup ───

describe('Auth E2E', () => {
    let app: INestApplication<App>;
    let mongoServer: MongoMemoryServer;
    let userModel: Model<UserDocument>;
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
                RedisModule,
                AuthModule,
                EmailModule,
                UsersModule,
                ReportsModule,
                StorageModule,
                PaymentsModule,
            ],
            controllers: [AppController],
            providers: [
                AppService,
                // Mirrors AppModule: both global providers must be present, or
                // e2e green-lights requests that production would reject.
                { provide: APP_GUARD, useClass: ThrottlerGuard },
                { provide: APP_INTERCEPTOR, useClass: OnboardingInterceptor },
            ],
        })
            .overrideProvider(REDIS_CLIENT)
            .useValue(redisMock)
            .overrideProvider(EmailService)
            .useValue(mockEmailService)
            .overrideProvider(CatalogService)
            .useValue(createCatalogServiceMock())
            .compile();

        app = moduleFixture.createNestApplication();
        app.use(cookieParser());
        app.setGlobalPrefix('api');
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new AllExceptionsFilter());
        await app.init();
        await listenOnLoopback(app);

        userModel = moduleFixture.get<Model<UserDocument>>(
            getModelToken(User.name)
        );
    }, 60_000);

    afterAll(async () => {
        await app.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        redisMock._clear();
        emailCalls.length = 0;
        mockEmailService.sendMagicLink.mockClear();
        mockEmailService.sendDeletionConfirmation.mockClear();
        await userModel.deleteMany({});
    });

    // ─── Helper functions ───

    async function createUserWithPassword(
        email: string,
        password: string
    ): Promise<UserDocument> {
        const hash = await bcrypt.hash(password, 10);
        return userModel.create({
            email: email.toLowerCase(),
            passwordHash: hash,
            profile: { firstName: 'Test', lastName: 'User' },
            executions: { balance: 0, freeReportUsed: false },
        });
    }

    async function createUserWithoutPassword(
        email: string
    ): Promise<UserDocument> {
        return userModel.create({
            email: email.toLowerCase(),
            profile: { firstName: 'Test', lastName: 'User' },
            executions: { balance: 0, freeReportUsed: false },
        });
    }

    async function softDeleteUser(email: string): Promise<void> {
        await userModel.updateOne(
            { email: email.toLowerCase() },
            { deletedAt: new Date() }
        );
    }

    function createMagicLinkToken(email: string, purpose = 'login'): string {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- inline utility in test helper
        const token = require('crypto').randomBytes(32).toString('hex');
        const payload = JSON.stringify({
            email: email.toLowerCase(),
            purpose,
        });
        redisMock._store.set(`magic:${token}`, payload);
        return token;
    }

    async function loginWithPassword(
        email: string,
        password: string
    ): Promise<{ accessToken: string; cookies: string[] }> {
        const res = await supertest(app.getHttpServer())
            .post('/api/auth/login/password')
            .send({ email, password })
            .expect(201);

        const body = res.body as { data: { accessToken: string } };
        return {
            accessToken: body.data.accessToken,
            cookies: res.headers['set-cookie'] as unknown as string[],
        };
    }

    async function loginViaMagicLink(
        email: string,
        purpose = 'login'
    ): Promise<{ accessToken: string; cookies: string[] }> {
        const token = createMagicLinkToken(email, purpose);
        const res = await supertest(app.getHttpServer())
            .post('/api/auth/magic-link/verify')
            .send({ token })
            .expect(201);

        const body = res.body as { data: { accessToken: string } };
        return {
            accessToken: body.data.accessToken,
            cookies: res.headers['set-cookie'] as unknown as string[],
        };
    }

    function extractRefreshCookie(cookies: string[]): string {
        const refreshCookie = cookies?.find((c: string) =>
            c.startsWith('bid_refresh=')
        );
        if (!refreshCookie) throw new Error('No bid_refresh cookie found');
        return refreshCookie.split(';')[0].replace('bid_refresh=', '');
    }

    // ─── A. Check Email flow ───

    describe('Check Email flow', () => {
        it('should return isNewUser: true for unknown email', async () => {
            const res = await supertest(app.getHttpServer())
                .post('/api/auth/check-email')
                .send({ email: 'new@example.com' })
                .expect(201);

            expect(res.body).toEqual({
                data: { hasPassword: false, isNewUser: true },
            });
        });

        it('should return hasPassword: true for user with password', async () => {
            await createUserWithPassword('user@example.com', 'password123');

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/check-email')
                .send({ email: 'user@example.com' })
                .expect(201);

            expect(res.body).toEqual({
                data: { hasPassword: true, isNewUser: false },
            });
        });

        it('should return hasPassword: false for user without password', async () => {
            await createUserWithoutPassword('oauth@example.com');

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/check-email')
                .send({ email: 'oauth@example.com' })
                .expect(201);

            expect(res.body).toEqual({
                data: { hasPassword: false, isNewUser: false },
            });
        });

        it('should return 400 for invalid email', async () => {
            await supertest(app.getHttpServer())
                .post('/api/auth/check-email')
                .send({ email: 'not-an-email' })
                .expect(400);
        });

        it('should rate limit after 10 requests from same IP', async () => {
            // First 10 should pass — but rate limit key increments each time
            // After checkEmailRateLimit sees count >= 10, it throws 429
            // We need to pre-seed the counter
            redisMock._store.set(`check_email:${LOOPBACK_IP}`, '10');

            await supertest(app.getHttpServer())
                .post('/api/auth/check-email')
                .send({ email: 'test@example.com' })
                .expect(429);
        });
    });

    // ─── B. Password Login flow ───

    describe('Password Login flow', () => {
        it('should return tokens and user on valid credentials', async () => {
            await createUserWithPassword('user@example.com', 'password123');

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'user@example.com', password: 'password123' })
                .expect(201);

            const body = res.body as {
                data: {
                    user: { email: string };
                    accessToken: string;
                };
            };
            expect(body.data.user.email).toBe('user@example.com');
            expect(body.data.accessToken).toBeDefined();
            expect(res.headers['set-cookie']).toBeDefined();
        });

        it('should set httpOnly bid_refresh cookie', async () => {
            await createUserWithPassword('user@example.com', 'password123');

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'user@example.com', password: 'password123' })
                .expect(201);

            const cookies = res.headers['set-cookie'] as unknown as string[];
            const refreshCookie = cookies.find((c: string) =>
                c.startsWith('bid_refresh=')
            );
            expect(refreshCookie).toBeDefined();
            expect(refreshCookie).toContain('HttpOnly');
            expect(refreshCookie).toContain('Path=/');
        });

        it('should return 401 on wrong password', async () => {
            await createUserWithPassword('user@example.com', 'correct');

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'user@example.com', password: 'wrong' })
                .expect(401);

            expect(res.body).toHaveProperty('error');
        });

        it('should return 401 for nonexistent email', async () => {
            await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password',
                })
                .expect(401);
        });

        it('should return 401 for user without password', async () => {
            await createUserWithoutPassword('oauth@example.com');

            await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'oauth@example.com', password: 'anypass1' })
                .expect(401);
        });

        it('should return 429 after progressive lockout threshold', async () => {
            // Pre-seed 5 failed attempts
            redisMock._store.set(
                `login_attempts:${LOOPBACK_IP}:user@example.com`,
                '5'
            );

            await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({
                    email: 'user@example.com',
                    password: 'anypass1',
                })
                .expect(429);
        });

        it('should clear login attempts on successful login', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            redisMock._store.set(
                `login_attempts:${LOOPBACK_IP}:user@example.com`,
                '3'
            );

            await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'user@example.com', password: 'password123' })
                .expect(201);

            expect(
                redisMock._store.has(
                    `login_attempts:${LOOPBACK_IP}:user@example.com`
                )
            ).toBe(false);
        });

        it('should return accountDeleted: true for deleted user', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            await softDeleteUser('user@example.com');

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'user@example.com', password: 'password123' })
                .expect(201);

            const body = res.body as {
                data: { accountDeleted?: boolean };
            };
            expect(body.data.accountDeleted).toBe(true);
        });
    });

    // ─── C. Magic Link flow ───

    describe('Magic Link flow', () => {
        it('should send magic link successfully', async () => {
            await supertest(app.getHttpServer())
                .post('/api/auth/magic-link/send')
                .send({ email: 'user@example.com' })
                .expect(201);

            expect(mockEmailService.sendMagicLink).toHaveBeenCalled();
        });

        it('should send with each publicly allowed purpose', async () => {
            const purposes = ['login', 'register', 'reset-password'];
            for (const purpose of purposes) {
                redisMock._clear();
                mockEmailService.sendMagicLink.mockClear();

                await supertest(app.getHttpServer())
                    .post('/api/auth/magic-link/send')
                    .send({ email: `test-${purpose}@example.com`, purpose })
                    .expect(201);

                expect(mockEmailService.sendMagicLink).toHaveBeenCalled();
            }
        });

        it('should reject delete-account purpose on the public endpoint', async () => {
            // Deletion links are issued only by POST /users/account/delete,
            // which authenticates the requester first.
            await supertest(app.getHttpServer())
                .post('/api/auth/magic-link/send')
                .send({
                    email: 'delete@example.com',
                    purpose: 'delete-account',
                })
                .expect(400);

            expect(mockEmailService.sendMagicLink).not.toHaveBeenCalled();
        });

        it('should rate limit after 3 requests for same email', async () => {
            redisMock._store.set('ratelimit:magic:rate@example.com', '3');

            await supertest(app.getHttpServer())
                .post('/api/auth/magic-link/send')
                .send({ email: 'rate@example.com' })
                .expect(429);
        });

        it('should skip sending on dedup but return success', async () => {
            redisMock._store.set(
                'magic_dedup:user@example.com:login',
                'existing-token'
            );

            await supertest(app.getHttpServer())
                .post('/api/auth/magic-link/send')
                .send({ email: 'user@example.com', purpose: 'login' })
                .expect(201);

            expect(mockEmailService.sendMagicLink).not.toHaveBeenCalled();
        });

        it('should verify magic link and return user + tokens', async () => {
            await createUserWithoutPassword('user@example.com');
            const token = createMagicLinkToken('user@example.com', 'login');

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/magic-link/verify')
                .send({ token })
                .expect(201);

            const body = res.body as {
                data: {
                    accessToken: string;
                    purpose: string;
                    user: { email: string };
                };
            };
            expect(body.data.accessToken).toBeDefined();
            expect(body.data.purpose).toBe('login');
            expect(body.data.user.email).toBe('user@example.com');

            // Cookie should be set
            const cookies = res.headers['set-cookie'] as unknown as string[];
            expect(
                cookies?.some((c: string) => c.startsWith('bid_refresh='))
            ).toBe(true);
        });

        it('should create new user on verify with register purpose', async () => {
            const token = createMagicLinkToken(
                'newuser@example.com',
                'register'
            );

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/magic-link/verify')
                .send({ token })
                .expect(201);

            const body = res.body as {
                data: { purpose: string; user: { email: string } };
            };
            expect(body.data.purpose).toBe('register');
            expect(body.data.user.email).toBe('newuser@example.com');

            // Verify user created in DB
            const user = await userModel.findOne({
                email: 'newuser@example.com',
            });
            expect(user).toBeTruthy();
        });

        it('should return purpose for reset-password', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const token = createMagicLinkToken(
                'user@example.com',
                'reset-password'
            );

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/magic-link/verify')
                .send({ token })
                .expect(201);

            const body = res.body as { data: { purpose: string } };
            expect(body.data.purpose).toBe('reset-password');
        });

        it('should soft-delete user for delete-account purpose', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const token = createMagicLinkToken(
                'user@example.com',
                'delete-account'
            );

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/magic-link/verify')
                .send({ token })
                .expect(201);

            const body = res.body as {
                data: { deleted: boolean; message: string };
            };
            expect(body.data.deleted).toBe(true);

            // Verify user is soft-deleted
            const user = await userModel.findOne({
                email: 'user@example.com',
            });
            expect(user?.deletedAt).toBeTruthy();

            // Deletion confirmation email should be sent
            expect(
                mockEmailService.sendDeletionConfirmation
            ).toHaveBeenCalled();
        });

        it('should return 401 for invalid/expired token', async () => {
            await supertest(app.getHttpServer())
                .post('/api/auth/magic-link/verify')
                .send({ token: 'a'.repeat(64) })
                .expect(401);
        });
    });

    // ─── D. Password Management ───

    describe('Password Management', () => {
        describe('POST /api/auth/password/set', () => {
            it('should set password for user without password', async () => {
                await createUserWithoutPassword('user@example.com');
                const { accessToken } =
                    await loginViaMagicLink('user@example.com');

                await supertest(app.getHttpServer())
                    .post('/api/auth/password/set')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ password: 'newpass123' })
                    .expect(201);

                // Verify password was set
                const user = await userModel.findOne({
                    email: 'user@example.com',
                });
                expect(user?.passwordHash).toBeTruthy();
            });

            it('should return 400 if password already set', async () => {
                await createUserWithPassword('user@example.com', 'existing1');
                const { accessToken } = await loginWithPassword(
                    'user@example.com',
                    'existing1'
                );

                await supertest(app.getHttpServer())
                    .post('/api/auth/password/set')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ password: 'newpass123' })
                    .expect(400);
            });

            it('should return 401 without auth', async () => {
                await supertest(app.getHttpServer())
                    .post('/api/auth/password/set')
                    .send({ password: 'newpass123' })
                    .expect(401);
            });
        });

        describe('POST /api/auth/password/change', () => {
            it('should change password and return new tokens', async () => {
                await createUserWithPassword('user@example.com', 'oldpass12');
                const { accessToken } = await loginWithPassword(
                    'user@example.com',
                    'oldpass12'
                );

                const res = await supertest(app.getHttpServer())
                    .post('/api/auth/password/change')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({
                        currentPassword: 'oldpass12',
                        newPassword: 'newpass12',
                    })
                    .expect(201);

                const body = res.body as {
                    data: { accessToken: string };
                };
                expect(body.data.accessToken).toBeDefined();

                // Cookie should be updated
                const cookies = res.headers[
                    'set-cookie'
                ] as unknown as string[];
                expect(
                    cookies?.some((c: string) => c.startsWith('bid_refresh='))
                ).toBe(true);
            });

            it('should return 401 on wrong current password', async () => {
                await createUserWithPassword('user@example.com', 'correct1');
                const { accessToken } = await loginWithPassword(
                    'user@example.com',
                    'correct1'
                );

                await supertest(app.getHttpServer())
                    .post('/api/auth/password/change')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({
                        currentPassword: 'wrongone',
                        newPassword: 'newpass12',
                    })
                    .expect(401);
            });

            it('should return 401 without auth', async () => {
                await supertest(app.getHttpServer())
                    .post('/api/auth/password/change')
                    .send({
                        currentPassword: 'old12345',
                        newPassword: 'new12345',
                    })
                    .expect(401);
            });
        });

        describe('POST /api/auth/password/verify', () => {
            it('should return isValid: true for correct password', async () => {
                await createUserWithPassword('user@example.com', 'password123');
                const { accessToken } = await loginWithPassword(
                    'user@example.com',
                    'password123'
                );

                const res = await supertest(app.getHttpServer())
                    .post('/api/auth/password/verify')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ password: 'password123' })
                    .expect(201);

                expect(res.body).toEqual({ data: { isValid: true } });
            });

            it('should return isValid: false for wrong password', async () => {
                await createUserWithPassword('user@example.com', 'password123');
                const { accessToken } = await loginWithPassword(
                    'user@example.com',
                    'password123'
                );

                const res = await supertest(app.getHttpServer())
                    .post('/api/auth/password/verify')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({ password: 'wrongpass' })
                    .expect(201);

                expect(res.body).toEqual({ data: { isValid: false } });
            });

            it('should return 401 without auth', async () => {
                await supertest(app.getHttpServer())
                    .post('/api/auth/password/verify')
                    .send({ password: 'anything' })
                    .expect(401);
            });
        });
    });

    // ─── E. User Profile ───

    describe('User Profile', () => {
        it('GET /api/users/me should return full profile', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const { accessToken } = await loginWithPassword(
                'user@example.com',
                'password123'
            );

            const res = await supertest(app.getHttpServer())
                .get('/api/users/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            const body = res.body as {
                data: {
                    id: string;
                    email: string;
                    profile: object;
                    executions: object;
                    hasPassword: boolean;
                    preferredLang: string;
                    deletedAt: null;
                };
            };
            expect(body.data.email).toBe('user@example.com');
            expect(body.data.hasPassword).toBe(true);
            expect(body.data.preferredLang).toBeDefined();
            expect(body.data.id).toBeDefined();
            expect(body.data.profile).toBeDefined();
            expect(body.data.executions).toBeDefined();
        });

        it('GET /api/users/me should return 401 without auth', async () => {
            await supertest(app.getHttpServer())
                .get('/api/users/me')
                .expect(401);
        });

        it('PATCH /api/users/me should update name', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const { accessToken } = await loginWithPassword(
                'user@example.com',
                'password123'
            );

            const res = await supertest(app.getHttpServer())
                .patch('/api/users/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ firstName: 'Updated', lastName: 'Name' })
                .expect(200);

            const body = res.body as {
                data: { profile: { firstName: string; lastName: string } };
            };
            expect(body.data.profile.firstName).toBe('Updated');
            expect(body.data.profile.lastName).toBe('Name');
        });

        it('PATCH /api/users/me should return 401 without auth', async () => {
            await supertest(app.getHttpServer())
                .patch('/api/users/me')
                .send({ firstName: 'Test' })
                .expect(401);
        });

        it('PATCH /api/users/me/lang should update language', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const { accessToken } = await loginWithPassword(
                'user@example.com',
                'password123'
            );

            await supertest(app.getHttpServer())
                .patch('/api/users/me/lang')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ lang: 'en' })
                .expect(200);

            const user = await userModel.findOne({
                email: 'user@example.com',
            });
            expect(user?.preferredLang).toBe('en');
        });

        it('PATCH /api/users/me/lang should return 401 without auth', async () => {
            await supertest(app.getHttpServer())
                .patch('/api/users/me/lang')
                .send({ lang: 'en' })
                .expect(401);
        });
    });

    // ─── E2. Onboarding gate ───

    describe('Onboarding gate', () => {
        async function createUserWithoutProfile(
            email: string,
            password: string
        ): Promise<UserDocument> {
            const hash = await bcrypt.hash(password, 10);
            return userModel.create({
                email: email.toLowerCase(),
                passwordHash: hash,
                profile: {},
                executions: { balance: 100, freeReportUsed: false },
            });
        }

        it('should block a guarded route until the profile is filled in', async () => {
            await createUserWithoutProfile('empty@example.com', 'password123');
            const { accessToken } = await loginWithPassword(
                'empty@example.com',
                'password123'
            );

            const res = await supertest(app.getHttpServer())
                .get('/api/users/me/executions/transactions')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(403);

            expect((res.body as { error: { code: string } }).error.code).toBe(
                'ONBOARDING_INCOMPLETE'
            );
        });

        it('should still allow routes marked with @SkipOnboarding', async () => {
            await createUserWithoutProfile('skip@example.com', 'password123');
            const { accessToken } = await loginWithPassword(
                'skip@example.com',
                'password123'
            );

            // GET /users/me is how the client learns the profile is incomplete —
            // gating it would deadlock onboarding.
            await supertest(app.getHttpServer())
                .get('/api/users/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);
        });

        it('should let the same user through once firstName is set', async () => {
            await createUserWithoutProfile('filled@example.com', 'password123');
            const { accessToken } = await loginWithPassword(
                'filled@example.com',
                'password123'
            );

            await supertest(app.getHttpServer())
                .patch('/api/users/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ firstName: 'Filled', lastName: 'In' })
                .expect(200);

            await supertest(app.getHttpServer())
                .get('/api/users/me/executions/transactions')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);
        });
    });

    // ─── F. Account Deletion flow ───

    describe('Account Deletion flow', () => {
        it('should return requiresPassword for user with password', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const { accessToken } = await loginWithPassword(
                'user@example.com',
                'password123'
            );

            const res = await supertest(app.getHttpServer())
                .post('/api/users/account/delete')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(201);

            expect(res.body).toEqual({
                data: { requiresPassword: true },
            });
        });

        it('should return requiresMagicLink for user without password', async () => {
            await createUserWithoutPassword('user@example.com');
            const { accessToken } = await loginViaMagicLink('user@example.com');

            const res = await supertest(app.getHttpServer())
                .post('/api/users/account/delete')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(201);

            const body = res.body as {
                data: { requiresMagicLink: boolean };
            };
            expect(body.data.requiresMagicLink).toBe(true);
            expect(mockEmailService.sendMagicLink).toHaveBeenCalled();
        });

        it('should confirm deletion with valid password', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const { accessToken } = await loginWithPassword(
                'user@example.com',
                'password123'
            );

            const res = await supertest(app.getHttpServer())
                .post('/api/users/account/delete/confirm')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ password: 'password123' })
                .expect(201);

            const body = res.body as {
                data: { code: string };
            };
            expect(body.data.code).toBe('ACCOUNT_DELETED');

            // Verify soft-deleted
            const user = await userModel.findOne({
                email: 'user@example.com',
            });
            expect(user?.deletedAt).toBeTruthy();

            // Verify cookie cleared
            const cookies = res.headers['set-cookie'] as unknown as string[];
            const cleared = cookies?.find((c: string) =>
                c.includes('bid_refresh=;')
            );
            expect(cleared).toBeDefined();
        });

        it('should reject deletion with wrong password', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const { accessToken } = await loginWithPassword(
                'user@example.com',
                'password123'
            );

            await supertest(app.getHttpServer())
                .post('/api/users/account/delete/confirm')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ password: 'wrongpass' })
                .expect(401);
        });

        it('should return 401 without auth', async () => {
            await supertest(app.getHttpServer())
                .post('/api/users/account/delete')
                .expect(401);
        });
    });

    // ─── G. Account Restore flow ───

    describe('Account Restore flow', () => {
        // Note: JwtStrategy rejects users with deletedAt set (returns null → 401).
        // This means deleted users cannot access /account/restore via JWT.
        it('should allow deleted user to restore via JwtAuthGuard (not JwtActiveGuard)', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const { accessToken } = await loginWithPassword(
                'user@example.com',
                'password123'
            );
            await softDeleteUser('user@example.com');

            // JwtAuthGuard allows deleted users — restore endpoint is accessible
            await supertest(app.getHttpServer())
                .post('/api/users/account/restore')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(201);
        });

        it('should return 400 when account is not deleted', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const { accessToken } = await loginWithPassword(
                'user@example.com',
                'password123'
            );

            await supertest(app.getHttpServer())
                .post('/api/users/account/restore')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(400);
        });

        it('should return 401 without auth', async () => {
            await supertest(app.getHttpServer())
                .post('/api/users/account/restore')
                .expect(401);
        });
    });

    // ─── H. Token Lifecycle ───

    describe('Token Lifecycle', () => {
        it('should refresh token and return new accessToken + cookie', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const { cookies } = await loginWithPassword(
                'user@example.com',
                'password123'
            );
            const refreshCookie = extractRefreshCookie(cookies);

            const res = await supertest(app.getHttpServer())
                // Body mirrors the web client: it always posts the browser timezone.
                .post('/api/auth/refresh')
                .set('Cookie', `bid_refresh=${refreshCookie}`)
                .send({ timezone: 'Europe/Kyiv' })
                .expect(201);

            const body = res.body as { data: { accessToken: string } };
            expect(body.data.accessToken).toBeDefined();

            const newCookies = res.headers['set-cookie'] as unknown as string[];
            expect(
                newCookies?.some((c: string) => c.startsWith('bid_refresh='))
            ).toBe(true);
        });

        it('should return 401 on refresh without cookie', async () => {
            await supertest(app.getHttpServer())
                .post('/api/auth/refresh')
                .send({ timezone: 'Europe/Kyiv' })
                .expect(401);
        });

        it('should logout and clear cookie', async () => {
            await createUserWithPassword('user@example.com', 'password123');
            const { cookies } = await loginWithPassword(
                'user@example.com',
                'password123'
            );
            const refreshCookie = extractRefreshCookie(cookies);

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/logout')
                .set('Cookie', `bid_refresh=${refreshCookie}`)
                .expect(201);

            const body = res.body as { data: { code: string } };
            expect(body.data.code).toBe('LOGGED_OUT');

            const resCookies = res.headers['set-cookie'] as unknown as string[];
            const cleared = resCookies?.find((c: string) =>
                c.includes('bid_refresh=;')
            );
            expect(cleared).toBeDefined();
        });

        it('GET /api/users/me should reject expired/invalid JWT', async () => {
            await supertest(app.getHttpServer())
                .get('/api/users/me')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);
        });
    });

    // ─── I. Response format ───

    describe('Response format', () => {
        it('success responses should have { data: {...} } format', async () => {
            await createUserWithPassword('user@example.com', 'password123');

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/check-email')
                .send({ email: 'user@example.com' })
                .expect(201);

            expect(res.body).toHaveProperty('data');
            expect(res.body).not.toHaveProperty('error');
        });

        it('error responses should have { error: { code, message } } format', async () => {
            const res = await supertest(app.getHttpServer())
                .get('/api/users/me')
                .expect(401);

            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toHaveProperty('code');
            expect(res.body.error).toHaveProperty('message');
        });

        it('validation errors should return 400', async () => {
            const res = await supertest(app.getHttpServer())
                .post('/api/auth/magic-link/send')
                .send({})
                .expect(400);

            expect(res.body).toHaveProperty('error');
        });
    });

    // ─── Terms consent tracking ───

    describe('Terms consent tracking', () => {
        it('should record termsVersion on password login when provided', async () => {
            await createUserWithPassword('terms@example.com', 'Password123');

            const { accessToken } = await loginWithPassword(
                'terms@example.com',
                'Password123'
            );

            // Login endpoint now accepts termsVersion — re-login with it
            await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({
                    email: 'terms@example.com',
                    password: 'Password123',
                    termsVersion: CURRENT_TERMS_VERSION,
                })
                .expect(201);

            const meRes = await supertest(app.getHttpServer())
                .get('/api/users/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(meRes.body.data.termsVersion).toBe(CURRENT_TERMS_VERSION);
        });

        it('should not fail login when termsVersion is not provided', async () => {
            await createUserWithPassword('noterms@example.com', 'Password123');

            await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'noterms@example.com', password: 'Password123' })
                .expect(201);
        });

        it('should accept terms via dedicated endpoint', async () => {
            await createUserWithPassword('accept@example.com', 'Password123');
            const { accessToken } = await loginWithPassword(
                'accept@example.com',
                'Password123'
            );

            const res = await supertest(app.getHttpServer())
                .post('/api/users/me/accept-terms')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ termsVersion: CURRENT_TERMS_VERSION })
                .expect(201);

            expect(res.body.data.code).toBe('TERMS_ACCEPTED');

            const meRes = await supertest(app.getHttpServer())
                .get('/api/users/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(meRes.body.data.termsVersion).toBe(CURRENT_TERMS_VERSION);
        });

        it('should reject accept-terms with wrong version', async () => {
            await createUserWithPassword('wrong@example.com', 'Password123');
            const { accessToken } = await loginWithPassword(
                'wrong@example.com',
                'Password123'
            );

            await supertest(app.getHttpServer())
                .post('/api/users/me/accept-terms')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ termsVersion: '2020-01-01' })
                .expect(400);
        });

        it('should expose termsVersion in getMe response', async () => {
            await createUserWithPassword('expose@example.com', 'Password123');
            const { accessToken } = await loginWithPassword(
                'expose@example.com',
                'Password123'
            );

            const res = await supertest(app.getHttpServer())
                .get('/api/users/me')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(res.body.data).toHaveProperty('termsVersion');
        });
    });

    // ─── Password Reset flow ───

    describe('POST /auth/password/reset', () => {
        it('should reset password with valid token', async () => {
            await createUserWithPassword('user@example.com', 'OldPassword1');
            const token = createMagicLinkToken(
                'user@example.com',
                'reset-password'
            );

            const res = await supertest(app.getHttpServer())
                .post('/api/auth/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword1',
                    confirmPassword: 'NewPassword1',
                })
                .expect(201);

            const body = res.body as {
                data: { code: string; message: string };
            };
            expect(body.data.code).toBe('PASSWORD_RESET');

            // Response must NOT contain accessToken
            expect(body.data).not.toHaveProperty('accessToken');

            // Old password should no longer work
            await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'user@example.com', password: 'OldPassword1' })
                .expect(401);

            // New password should work
            await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'user@example.com', password: 'NewPassword1' })
                .expect(201);
        });

        it('should reject invalid token', async () => {
            await supertest(app.getHttpServer())
                .post('/api/auth/password/reset')
                .send({
                    token: 'invalid-token',
                    newPassword: 'NewPassword1',
                    confirmPassword: 'NewPassword1',
                })
                .expect(401);
        });

        it('should reject expired/used token (second use)', async () => {
            await createUserWithPassword('user@example.com', 'OldPassword1');
            const token = createMagicLinkToken(
                'user@example.com',
                'reset-password'
            );

            // First use — success
            await supertest(app.getHttpServer())
                .post('/api/auth/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword1',
                    confirmPassword: 'NewPassword1',
                })
                .expect(201);

            // Second use — GETDEL already consumed
            await supertest(app.getHttpServer())
                .post('/api/auth/password/reset')
                .send({
                    token,
                    newPassword: 'AnotherPwd1',
                    confirmPassword: 'AnotherPwd1',
                })
                .expect(401);
        });

        it('should reject token with wrong purpose', async () => {
            await createUserWithoutPassword('user@example.com');
            const token = createMagicLinkToken('user@example.com', 'login');

            await supertest(app.getHttpServer())
                .post('/api/auth/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword1',
                    confirmPassword: 'NewPassword1',
                })
                .expect(400);
        });

        it('should reject mismatched passwords', async () => {
            await createUserWithPassword('user@example.com', 'OldPassword1');
            const token = createMagicLinkToken(
                'user@example.com',
                'reset-password'
            );

            await supertest(app.getHttpServer())
                .post('/api/auth/password/reset')
                .send({
                    token,
                    newPassword: 'aaaaaaaa',
                    confirmPassword: 'bbbbbbbb',
                })
                .expect(400);
        });

        it('should reject short password', async () => {
            await createUserWithPassword('user@example.com', 'OldPassword1');
            const token = createMagicLinkToken(
                'user@example.com',
                'reset-password'
            );

            await supertest(app.getHttpServer())
                .post('/api/auth/password/reset')
                .send({
                    token,
                    newPassword: '123',
                    confirmPassword: '123',
                })
                .expect(400);
        });

        it('should revoke all existing sessions after reset', async () => {
            await createUserWithPassword('user@example.com', 'OldPassword1');

            // Login to get a refresh token
            const { cookies } = await loginWithPassword(
                'user@example.com',
                'OldPassword1'
            );
            const refreshToken = extractRefreshCookie(cookies);

            // Reset password
            const token = createMagicLinkToken(
                'user@example.com',
                'reset-password'
            );
            await supertest(app.getHttpServer())
                .post('/api/auth/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword1',
                    confirmPassword: 'NewPassword1',
                })
                .expect(201);

            // Old refresh token should be revoked
            await supertest(app.getHttpServer())
                .post('/api/auth/refresh')
                .set('Cookie', `bid_refresh=${refreshToken}`)
                .send({ timezone: 'Europe/Kyiv' })
                .expect(401);
        });

        it('should work for OAuth-only user without existing password', async () => {
            await createUserWithoutPassword('oauth@example.com');
            const token = createMagicLinkToken(
                'oauth@example.com',
                'reset-password'
            );

            await supertest(app.getHttpServer())
                .post('/api/auth/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword1',
                    confirmPassword: 'NewPassword1',
                })
                .expect(201);

            // Should now be able to login with password
            await supertest(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({
                    email: 'oauth@example.com',
                    password: 'NewPassword1',
                })
                .expect(201);
        });
    });
});
