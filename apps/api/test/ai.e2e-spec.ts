import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as cookieParser from 'cookie-parser';
import * as supertest from 'supertest';
import { App } from 'supertest/types';
import { ZodValidationPipe } from 'nestjs-zod';
import { Readable } from 'stream';
import * as http from 'http';
import { Model } from 'mongoose';
import { createHmac } from 'crypto';

import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { OnboardingInterceptor } from '../src/common/interceptors/onboarding.interceptor';
import { RedisModule, REDIS_CLIENT } from '../src/common/modules/redis.module';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { AuthModule } from '../src/modules/auth/auth.module';
import { EmailModule } from '../src/modules/email/email.module';
import { UsersModule } from '../src/modules/users/users.module';
import { AiModule } from '../src/modules/ai/ai.module';
import { User, UserDocument } from '../src/modules/users/schemas/user.schema';
import {
    ExecutionTransaction,
    ExecutionTransactionDocument,
} from '../src/modules/users/schemas/execution-transaction.schema';
import {
    ChatMessage,
    ChatMessageDocument,
} from '../src/modules/ai/schemas/chat-message.schema';
import { EmailService } from '../src/modules/email/email.service';
import {
    AI_PROVIDER,
    type IAiProvider,
} from '../src/modules/ai/interfaces/ai-provider.interface';
import { AiRateLimitGuard } from '../src/modules/ai/guards/ai-rate-limit.guard';
import { ReservationReconcileService } from '../src/modules/users/reservation-reconcile.service';
import { ENV } from '../src/config/env';
import {
    createStatefulRedisMock,
    type StatefulRedisMock,
} from './utils/redis.mock';
import { listenOnLoopback } from './utils/listen';

// Env comes from src/test-setup.ts (jest-e2e.json setupFiles) — the real
// fail-fast loader runs against placeholder values, so a newly required var
// breaks the suite immediately instead of silently missing from a hand-written mock.
// The IP rate limit is a plain constant, so the suite overrides AiRateLimitGuard
// with a pass-through: several tests fire parallel requests from one IP on
// purpose, and the account-level guards are what they assert. The IP counter
// itself is covered by ai-rate-limit.guard.spec.ts.

// ─── Mock AI provider ────────────────────────────────────────────────────────

// Typed against IAiProvider so the stub keeps the `signal` parameter the
// controller relies on for abort handling — an untyped jest.fn() would let a
// zero-arg implementation silently drop it.
const mockAiProvider: jest.Mocked<IAiProvider> = {
    contextWindow: 200_000,
    countTokens: jest.fn(),
    streamChat: jest.fn(),
};

/** Default provider behaviour, restored before every test. */
function resetAiProviderDefaults(): void {
    mockAiProvider.countTokens.mockResolvedValue(500);
    mockAiProvider.streamChat.mockImplementation(() =>
        Promise.resolve(Readable.from(['Hello', ' world', '!']))
    );
}

const mockEmailService = {
    sendMagicLink: jest.fn().mockResolvedValue(undefined),
    sendDeletionConfirmation: jest.fn().mockResolvedValue(undefined),
    sendDeletionReminder: jest.fn().mockResolvedValue(undefined),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createUser(
    userModel: Model<UserDocument>,
    overrides: Record<string, unknown> = {}
) {
    return userModel.create({
        email: `test-${Date.now()}@test.com`,
        preferredLang: 'en',
        executions: {
            balance: 1000,
            freeReportUsed: false,
            activeReservation: null,
        },
        ai: { requestsUsed: 0, bonusGranted: false },
        profile: { firstName: 'Test' },
        termsAcceptedAt: new Date(),
        termsVersion: '1.0',
        ...overrides,
    });
}

function getAccessToken(_app: INestApplication<App>, userId: string): string {
    const header = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT' })
    ).toString('base64url');
    const payload = Buffer.from(
        JSON.stringify({
            sub: userId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 900,
        })
    ).toString('base64url');
    // Signed with the same secret the JwtStrategy reads, so the token stays
    // valid if the test env placeholder ever changes.
    const signature = createHmac('sha256', ENV.JWT_ACCESS_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');
    return `${header}.${payload}.${signature}`;
}

function parseSSEEvents(body: string): Array<Record<string, unknown>> {
    return body
        .split('\n\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => JSON.parse(line.replace('data: ', '')));
}

/**
 * Provider stub that hands back a stream we feed by hand and exposes the exact
 * moment the *server* observes the client disconnect.
 *
 * The controller passes its `AbortController.signal` down to the provider, so
 * that signal is the only trustworthy proof that `res.on('close')` fired.
 * Without it a test can only sleep and hope — and a sleep that finishes before
 * the server notices makes the request look like a normal completed stream,
 * which is a different code path with different billing rules.
 */
function createControlledStream(): {
    stream: Readable;
    serverSawAbort: Promise<void>;
} {
    const stream = new Readable({ read() {} });
    let markAborted: () => void;
    const serverSawAbort = new Promise<void>((resolve) => {
        markAborted = resolve;
    });

    mockAiProvider.streamChat.mockImplementation(
        (_messages, _systemPrompt, _maxTokens, signal) => {
            signal?.addEventListener('abort', () => markAborted());
            return Promise.resolve(stream);
        }
    );

    return { stream, serverSawAbort };
}

/**
 * Polls until `predicate` holds. The controller finishes commit/refund in a
 * `finally` block after the socket is already gone, so there is no response to
 * await — polling with a deadline is deterministic where a fixed sleep is a
 * coin flip under CI load.
 */
async function waitUntil(
    predicate: () => Promise<boolean>,
    label: string,
    timeoutMs = 10_000
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Timed out waiting for: ${label}`);
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('AI Chat E2E', () => {
    let app: INestApplication<App>;
    let mongoServer: MongoMemoryReplSet;
    let userModel: Model<UserDocument>;
    let transactionModel: Model<ExecutionTransactionDocument>;
    let chatMessageModel: Model<ChatMessageDocument>;
    let reconcileService: ReservationReconcileService;
    let redisMock: StatefulRedisMock;

    beforeAll(async () => {
        mongoServer = await MongoMemoryReplSet.create({
            replSet: { count: 1 },
        });
        redisMock = createStatefulRedisMock();

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                ThrottlerModule.forRoot({
                    throttlers: [{ ttl: 60000, limit: 600 }],
                }),
                ScheduleModule.forRoot(),
                MongooseModule.forRoot(mongoServer.getUri()),
                RedisModule,
                AuthModule,
                EmailModule,
                UsersModule,
                AiModule,
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
            .overrideProvider(AI_PROVIDER)
            .useValue(mockAiProvider)
            .overrideProvider(AiRateLimitGuard)
            .useValue({ canActivate: () => true })
            .compile();

        app = moduleFixture.createNestApplication({ rawBody: true });
        app.use(cookieParser());
        app.setGlobalPrefix('api');
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new AllExceptionsFilter());
        await app.init();
        await listenOnLoopback(app); // Real port — the abort tests drive raw HTTP

        userModel = moduleFixture.get<Model<UserDocument>>(
            getModelToken(User.name)
        );
        transactionModel = moduleFixture.get<
            Model<ExecutionTransactionDocument>
        >(getModelToken(ExecutionTransaction.name));
        chatMessageModel = moduleFixture.get<Model<ChatMessageDocument>>(
            getModelToken(ChatMessage.name)
        );
        reconcileService = moduleFixture.get(ReservationReconcileService);
    }, 120_000);

    afterAll(async () => {
        await app.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        redisMock._clear();
        resetAiProviderDefaults();
        await userModel.deleteMany({});
        await transactionModel.deleteMany({});
        await chatMessageModel.deleteMany({});
    });

    describe('Single request sanity', () => {
        it('should complete happy path: reserve → stream → commit → DONE', async () => {
            const user = await createUser(userModel);
            const token = getAccessToken(app, user._id.toString());

            const res = await supertest(app.getHttpServer())
                .post('/api/ai/chat')
                .set('Authorization', `Bearer ${token}`)
                .send({ message: 'Hello AI' });

            const events = parseSSEEvents(res.text);
            const doneEvent = events.find((e) => e.type === 'done');

            expect(doneEvent).toBeDefined();
            expect(doneEvent!.balanceAfter).toBe(800); // 1000 - 200

            // Verify DB state
            const updatedUser = await userModel.findById(user._id);
            expect(updatedUser!.executions.balance).toBe(800);
            expect(updatedUser!.executions.activeReservation).toBeNull();
            expect(updatedUser!.ai.requestsUsed).toBe(1);

            // Verify ledger
            const txns = await transactionModel.find({ userId: user._id });
            expect(txns).toHaveLength(1);
            expect(txns[0].action).toBe('ai_chat');
            expect(txns[0].amount).toBe(200);
            expect(txns[0].reservationId).toBeDefined();

            // Verify history
            const messages = await chatMessageModel.find({ userId: user._id });
            expect(messages).toHaveLength(2);
            expect(messages[0].role).toBe('user');
            expect(messages[1].role).toBe('assistant');
            expect(messages[1].content).toBe('Hello world!');
        });
    });

    describe('Race on balance', () => {
        it('should allow exactly 1 of 5 parallel requests when balance = AI_CHAT_COST', async () => {
            const user = await createUser(userModel, {
                executions: {
                    balance: 200,
                    freeReportUsed: false,
                    activeReservation: null,
                },
            });
            const token = getAccessToken(app, user._id.toString());

            const results = await Promise.allSettled(
                Array.from({ length: 5 }, () =>
                    supertest(app.getHttpServer())
                        .post('/api/ai/chat')
                        .set('Authorization', `Bearer ${token}`)
                        .send({ message: 'Race test' })
                )
            );

            const responses = results
                .filter(
                    (r): r is PromiseFulfilledResult<supertest.Response> =>
                        r.status === 'fulfilled'
                )
                .map((r) => r.value);

            const successes = responses.filter((r) =>
                r.text.includes('"type":"done"')
            );
            const failures = responses.filter(
                (r) => !r.text.includes('"type":"done"')
            );

            expect(successes).toHaveLength(1);
            expect(failures).toHaveLength(4);

            // Non-200 failures should be 400 (INSUFFICIENT) or 409 (RESERVATION_ACTIVE)
            for (const fail of failures.filter((r) => r.status !== 200)) {
                expect([400, 409]).toContain(fail.status);
            }

            // DB: balance=0, requestsUsed=1, reservation cleared
            const updatedUser = await userModel.findById(user._id);
            expect(updatedUser!.executions.balance).toBe(0);
            expect(updatedUser!.executions.activeReservation).toBeNull();
            expect(updatedUser!.ai.requestsUsed).toBe(1);

            // Exactly 1 ledger entry
            const txns = await transactionModel.find({ userId: user._id });
            expect(txns).toHaveLength(1);
        });
    });

    describe('Race on lifetime limit', () => {
        it('should allow exactly 1 of 5 parallel requests when requestsUsed = limit - 1', async () => {
            const user = await createUser(userModel, {
                executions: {
                    balance: 10000,
                    freeReportUsed: false,
                    activeReservation: null,
                },
                ai: { requestsUsed: 4, bonusGranted: false },
            });
            const token = getAccessToken(app, user._id.toString());

            const results = await Promise.allSettled(
                Array.from({ length: 5 }, () =>
                    supertest(app.getHttpServer())
                        .post('/api/ai/chat')
                        .set('Authorization', `Bearer ${token}`)
                        .send({ message: 'Limit race' })
                )
            );

            const responses = results
                .filter(
                    (r): r is PromiseFulfilledResult<supertest.Response> =>
                        r.status === 'fulfilled'
                )
                .map((r) => r.value);

            const successes = responses.filter((r) =>
                r.text.includes('"type":"done"')
            );
            const failures = responses.filter(
                (r) => !r.text.includes('"type":"done"')
            );

            expect(successes).toHaveLength(1);
            expect(failures).toHaveLength(4);

            for (const fail of failures.filter((r) => r.status >= 400)) {
                expect([403, 409]).toContain(fail.status);
            }

            const updatedUser = await userModel.findById(user._id);
            expect(updatedUser!.ai.requestsUsed).toBe(5);
            expect(updatedUser!.executions.activeReservation).toBeNull();
        });
    });

    describe('Cron reconcile', () => {
        it('should refund expired reservation with compensation', async () => {
            // Create user with an expired reservation (manually set)
            const user = await createUser(userModel, {
                executions: {
                    balance: 800,
                    freeReportUsed: false,
                    activeReservation: {
                        id: 'expired-reservation-id',
                        amount: 200,
                        reservedAt: new Date(Date.now() - 600_000),
                        expiresAt: new Date(Date.now() - 60_000), // expired 1 min ago
                        feature: 'ai_chat',
                        compensationOps: { inc: { 'ai.requestsUsed': -1 } },
                    },
                },
                ai: { requestsUsed: 3, bonusGranted: false },
            });

            await reconcileService.reconcileExpiredReservations();

            const updatedUser = await userModel.findById(user._id);
            expect(updatedUser!.executions.activeReservation).toBeNull();
            expect(updatedUser!.executions.balance).toBe(1000); // 800 + 200 restored
            expect(updatedUser!.ai.requestsUsed).toBe(2); // 3 - 1 compensation
        });
    });

    describe('Stale commit detection', () => {
        it('should not create ledger entry when reservation was already cleared', async () => {
            const user = await createUser(userModel);
            const token = getAccessToken(app, user._id.toString());

            // Slow provider: gives time to manipulate DB between reserve and commit
            mockAiProvider.streamChat.mockImplementation(async () => {
                // Simulate reservation cleared by cron between reserve and stream
                await userModel.findByIdAndUpdate(user._id, {
                    $set: { 'executions.activeReservation': null },
                });
                return Readable.from(['chunk']);
            });

            const res = await supertest(app.getHttpServer())
                .post('/api/ai/chat')
                .set('Authorization', `Bearer ${token}`)
                .send({ message: 'Stale test' });

            // Should get SSE ERROR (commit fails due to stale reservation)
            const events = parseSSEEvents(res.text);
            const errorEvent = events.find((e) => e.type === 'error');
            expect(errorEvent).toBeDefined();

            // No ledger entry
            const txns = await transactionModel.find({ userId: user._id });
            expect(txns).toHaveLength(0);
        });
    });

    describe('Double refund safety', () => {
        it('should decrement requestsUsed exactly once on double refund', async () => {
            const user = await createUser(userModel, {
                executions: {
                    balance: 800,
                    freeReportUsed: false,
                    activeReservation: {
                        id: 'double-refund-id',
                        amount: 200,
                        reservedAt: new Date(),
                        expiresAt: new Date(Date.now() + 300_000),
                        feature: 'ai_chat',
                        compensationOps: { inc: { 'ai.requestsUsed': -1 } },
                    },
                },
                ai: { requestsUsed: 3, bonusGranted: false },
            });

            // Get UsersService and call refund twice
            const { UsersService } =
                await import('../src/modules/users/users.service');
            const usersService = app.get(UsersService);

            await usersService.refundReservation(
                user._id.toString(),
                'double-refund-id'
            );
            await usersService.refundReservation(
                user._id.toString(),
                'double-refund-id'
            );

            const updatedUser = await userModel.findById(user._id);
            expect(updatedUser!.executions.balance).toBe(1000); // 800 + 200 (once)
            expect(updatedUser!.ai.requestsUsed).toBe(2); // 3 - 1 (once)
            expect(updatedUser!.executions.activeReservation).toBeNull();
        });
    });

    /**
     * Raw HTTP request — supertest owns its socket and cannot destroy a
     * connection mid-flight, which is exactly what these tests need.
     *
     * `headersReceived` resolves when the SSE headers arrive: at that point the
     * reservation is already taken and the controller is parked in its
     * streaming loop. `firstToken` resolves once a TOKEN event reaches the
     * client, which is the boundary of the refund policy.
     */
    function openChatRequest(
        accessToken: string,
        message: string
    ): {
        request: http.ClientRequest;
        headersReceived: Promise<void>;
        firstToken: Promise<void>;
    } {
        const { port } = (app.getHttpServer() as http.Server).address() as {
            port: number;
        };
        const body = JSON.stringify({ message });

        let onHeaders!: () => void;
        const headersReceived = new Promise<void>((resolve) => {
            onHeaders = resolve;
        });
        let onFirstToken!: () => void;
        const firstToken = new Promise<void>((resolve) => {
            onFirstToken = resolve;
        });

        const request = http.request(
            {
                hostname: '127.0.0.1',
                port,
                path: '/api/ai/chat',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            (res) => {
                onHeaders();
                let received = '';
                res.on('data', (chunk: Buffer | string) => {
                    received += chunk.toString();
                    if (received.includes('"type":"token"')) onFirstToken();
                });
                res.on('error', () => {});
            }
        );
        // Destroying the socket surfaces as ECONNRESET on the client side.
        request.on('error', () => {});
        request.write(body);
        request.end();

        return { request, headersReceived, firstToken };
    }

    describe('Client abort before first token', () => {
        it('should refund: balance restored, requestsUsed compensated, no ledger/history', async () => {
            const user = await createUser(userModel);
            const token = getAccessToken(app, user._id.toString());
            const { stream, serverSawAbort } = createControlledStream();

            const { request, headersReceived } = openChatRequest(
                token,
                'Abort before token'
            );

            await headersReceived; // reservation taken, stream loop running
            request.destroy(); // client goes away without a single token
            await serverSawAbort; // server registered the disconnect
            stream.push(null); // unblock the controller's stream loop

            await waitUntil(
                async () =>
                    (await userModel.findById(user._id))!.executions
                        .activeReservation === null,
                'reservation released after abort'
            );

            // Fully refunded — the abort landed before the first token.
            const updatedUser = await userModel.findById(user._id);
            expect(updatedUser!.executions.balance).toBe(1000);
            expect(updatedUser!.ai.requestsUsed).toBe(0);

            const txns = await transactionModel.find({ userId: user._id });
            expect(txns).toHaveLength(0);

            const messages = await chatMessageModel.find({ userId: user._id });
            expect(messages).toHaveLength(0);
        }, 30_000);
    });

    describe('Client abort after first token', () => {
        it('should commit (non-refundable): balance debited, requestsUsed incremented, ledger+history present', async () => {
            const user = await createUser(userModel);
            const token = getAccessToken(app, user._id.toString());
            const { stream, serverSawAbort } = createControlledStream();

            const { request, headersReceived, firstToken } = openChatRequest(
                token,
                'Abort after token'
            );

            await headersReceived;
            stream.push('Partial response');
            await firstToken; // client received a token — past the refund line
            request.destroy();
            await serverSawAbort;
            stream.push(null);

            await waitUntil(
                async () =>
                    (await userModel.findById(user._id))!.executions
                        .activeReservation === null,
                'reservation closed after abort'
            );

            // Committed, not refunded — tokens were already delivered.
            const updatedUser = await userModel.findById(user._id);
            expect(updatedUser!.executions.balance).toBe(800);
            expect(updatedUser!.ai.requestsUsed).toBe(1);

            const txns = await transactionModel.find({ userId: user._id });
            expect(txns).toHaveLength(1);
            expect(txns[0].action).toBe('ai_chat');

            const messages = await chatMessageModel
                .find({ userId: user._id })
                .sort({ createdAt: 1 });
            expect(messages).toHaveLength(2);
            expect(messages[0].role).toBe('user');
            expect(messages[1].role).toBe('assistant');
            expect(messages[1].content).toBe('Partial response');
        }, 30_000);
    });
});
