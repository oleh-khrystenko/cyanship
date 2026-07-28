import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { ZodValidationPipe } from 'nestjs-zod';

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
import { EmailService } from '../src/modules/email/email.service';
import { CatalogService } from '../src/modules/payments/catalog.service';
import { createStatefulRedisMock } from './utils/redis.mock';
import { createCatalogServiceMock } from './utils/catalog.mock';
import { listenOnLoopback } from './utils/listen';

// Env comes from src/test-setup.ts (jest-e2e.json setupFiles) — the real
// fail-fast loader runs against placeholder values, so a newly required var
// breaks the suite immediately instead of silently missing from a hand-written mock.

const mockEmailService = {
    sendMagicLink: jest.fn().mockResolvedValue(undefined),
    sendDeletionConfirmation: jest.fn().mockResolvedValue(undefined),
};

describe('App (e2e)', () => {
    let app: INestApplication<App>;
    let mongoServer: MongoMemoryServer;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const redisMock = createStatefulRedisMock();

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                ThrottlerModule.forRoot({
                    throttlers: [{ ttl: 60000, limit: 60 }],
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
    }, 60_000);

    afterAll(async () => {
        await app.close();
        await mongoServer.stop();
    });

    describe('GET /api', () => {
        it('should return Hello World', () => {
            return request(app.getHttpServer())
                .get('/api')
                .expect(200)
                .expect('Hello World!');
        });
    });

    describe('GET /api/health', () => {
        it('should return health status', () => {
            return request(app.getHttpServer())
                .get('/api/health')
                .expect(200)
                .expect((res: request.Response) => {
                    const body = res.body as {
                        status: string;
                        timestamp: string;
                        environment: string;
                    };
                    expect(body).toMatchObject({
                        status: 'ok',
                        environment: 'test',
                    });
                    expect(body.timestamp).toBeDefined();
                });
        });
    });

    describe('Auth endpoints', () => {
        it('POST /api/auth/magic-link/send should require email', () => {
            return request(app.getHttpServer())
                .post('/api/auth/magic-link/send')
                .send({})
                .expect(400);
        });

        it('POST /api/auth/magic-link/verify should reject invalid token', () => {
            return request(app.getHttpServer())
                .post('/api/auth/magic-link/verify')
                .send({ token: 'a'.repeat(64) })
                .expect(401);
        });

        it('POST /api/auth/refresh should reject when no cookie', () => {
            return request(app.getHttpServer())
                .post('/api/auth/refresh')
                .send({ timezone: 'Europe/Kyiv' })
                .expect(401);
        });

        it('POST /api/auth/logout should succeed without cookie', () => {
            return request(app.getHttpServer())
                .post('/api/auth/logout')
                .expect(201)
                .expect((res: request.Response) => {
                    const body = res.body as {
                        data: { message: string };
                    };
                    expect(body.data.message).toBe('Logged out');
                });
        });
    });

    describe('Users endpoints', () => {
        it('GET /api/users/me should require auth', () => {
            return request(app.getHttpServer())
                .get('/api/users/me')
                .expect(401);
        });
    });
});
