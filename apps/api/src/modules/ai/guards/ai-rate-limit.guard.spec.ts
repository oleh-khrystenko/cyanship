import {
    ExecutionContext,
    ForbiddenException,
    HttpException,
    HttpStatus,
    InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { RESPONSE_CODE } from '@cyanship/types';

import { RedisCounterService } from '../../../common/services/redis-counter.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { AiRateLimitGuard } from './ai-rate-limit.guard';

jest.mock('../../../config/env', () => ({
    ENV: {
        AI_CHAT_FREE_LIMIT: 5,
        AI_CHAT_BONUS_AMOUNT: 5,
        AI_CHAT_IP_LIMIT: 20,
    },
}));

const mockRedisCounter = {
    incrementFixedWindow: jest.fn(),
    incrementSlidingWindow: jest.fn(),
};

/** Builds a minimal ExecutionContext stub with a user + request shape. */
const buildContext = (
    user: Partial<UserDocument> & {
        ai?: { requestsUsed: number; bonusGranted: boolean };
    },
    request: Partial<Request> = {}
): ExecutionContext => {
    const fullRequest = {
        user,
        ip: '127.0.0.1',
        headers: {},
        ...request,
    };
    return {
        switchToHttp: () => ({
            getRequest: () => fullRequest,
        }),
    } as unknown as ExecutionContext;
};

describe('AiRateLimitGuard', () => {
    let guard: AiRateLimitGuard;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AiRateLimitGuard,
                { provide: RedisCounterService, useValue: mockRedisCounter },
            ],
        }).compile();

        guard = module.get<AiRateLimitGuard>(AiRateLimitGuard);
        jest.clearAllMocks();
        // Default: IP counter starts at 1 (well under any reasonable limit)
        mockRedisCounter.incrementFixedWindow.mockResolvedValue(1);
    });

    describe('checkAccountLimit', () => {
        it('should allow user with requestsUsed below free limit', async () => {
            const ctx = buildContext({
                ai: { requestsUsed: 4, bonusGranted: false },
            });

            await expect(guard.canActivate(ctx)).resolves.toBe(true);
        });

        it('should throw AI_LIMIT_EXHAUSTED when requestsUsed equals free limit (no bonus)', async () => {
            const ctx = buildContext({
                ai: { requestsUsed: 5, bonusGranted: false },
            });

            await expect(guard.canActivate(ctx)).rejects.toThrow(
                ForbiddenException
            );
            await expect(guard.canActivate(ctx)).rejects.toMatchObject({
                response: { code: RESPONSE_CODE.AI_LIMIT_EXHAUSTED },
            });
        });

        it('should extend the limit by bonus amount when bonusGranted is true', async () => {
            const ctx = buildContext({
                ai: { requestsUsed: 9, bonusGranted: true },
            });

            // free (5) + bonus (5) = 10. requestsUsed = 9 → still under
            await expect(guard.canActivate(ctx)).resolves.toBe(true);
        });

        it('should throw when requestsUsed reaches free + bonus combined', async () => {
            const ctx = buildContext({
                ai: { requestsUsed: 10, bonusGranted: true },
            });

            await expect(guard.canActivate(ctx)).rejects.toThrow(
                ForbiddenException
            );
        });

        it('should treat missing ai field as zero usage', async () => {
            const ctx = buildContext({ ai: undefined });

            await expect(guard.canActivate(ctx)).resolves.toBe(true);
        });

        it('should NOT call IP counter when account limit rejects', async () => {
            const ctx = buildContext({
                ai: { requestsUsed: 5, bonusGranted: false },
            });

            await expect(guard.canActivate(ctx)).rejects.toThrow();
            expect(
                mockRedisCounter.incrementFixedWindow
            ).not.toHaveBeenCalled();
        });
    });

    describe('checkIpLimit', () => {
        const passingUser = {
            ai: { requestsUsed: 0, bonusGranted: false },
        };

        it('should call incrementFixedWindow with correct key and 24h TTL', async () => {
            const ctx = buildContext(passingUser, { ip: '203.0.113.7' });

            await guard.canActivate(ctx);

            expect(mockRedisCounter.incrementFixedWindow).toHaveBeenCalledWith(
                'ai:ip:203.0.113.7',
                86400
            );
        });

        it('should prefer x-forwarded-for over request.ip', async () => {
            const ctx = buildContext(passingUser, {
                ip: '127.0.0.1',
                headers: { 'x-forwarded-for': '198.51.100.42' },
            });

            await guard.canActivate(ctx);

            expect(mockRedisCounter.incrementFixedWindow).toHaveBeenCalledWith(
                'ai:ip:198.51.100.42',
                86400
            );
        });

        it('should pick the first IP when x-forwarded-for is a comma list', async () => {
            const ctx = buildContext(passingUser, {
                headers: {
                    'x-forwarded-for': '198.51.100.42, 10.0.0.1, 10.0.0.2',
                },
            });

            await guard.canActivate(ctx);

            expect(mockRedisCounter.incrementFixedWindow).toHaveBeenCalledWith(
                'ai:ip:198.51.100.42',
                86400
            );
        });

        it('should fall back to "unknown" when no IP info is available', async () => {
            const ctx = buildContext(passingUser, {
                ip: undefined,
                headers: {},
            });

            await guard.canActivate(ctx);

            expect(mockRedisCounter.incrementFixedWindow).toHaveBeenCalledWith(
                'ai:ip:unknown',
                86400
            );
        });

        it('should pass when count is at the limit (20th request)', async () => {
            mockRedisCounter.incrementFixedWindow.mockResolvedValue(20);
            const ctx = buildContext(passingUser);

            await expect(guard.canActivate(ctx)).resolves.toBe(true);
        });

        it('should throw 429 with AI_RATE_LIMIT_EXCEEDED on the 21st request', async () => {
            mockRedisCounter.incrementFixedWindow.mockResolvedValue(21);
            const ctx = buildContext(passingUser);

            const error = await guard.canActivate(ctx).catch((e: unknown) => e);

            expect(error).toBeInstanceOf(HttpException);
            expect((error as HttpException).getStatus()).toBe(
                HttpStatus.TOO_MANY_REQUESTS
            );
            expect((error as HttpException).getResponse()).toMatchObject({
                code: RESPONSE_CODE.AI_RATE_LIMIT_EXCEEDED,
            });
        });

        it('should wrap Redis errors in InternalServerErrorException', async () => {
            mockRedisCounter.incrementFixedWindow.mockRejectedValue(
                new Error('Redis connection lost')
            );
            const ctx = buildContext(passingUser);

            await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
                InternalServerErrorException
            );
        });

        it('should NOT wrap HttpException from limit check (passes through as 429)', async () => {
            // Sanity check: the catch block must not double-wrap our own 429.
            mockRedisCounter.incrementFixedWindow.mockResolvedValue(99);
            const ctx = buildContext(passingUser);

            const error = await guard.canActivate(ctx).catch((e: unknown) => e);

            expect(error).toBeInstanceOf(HttpException);
            expect(error).not.toBeInstanceOf(InternalServerErrorException);
            expect((error as HttpException).getStatus()).toBe(
                HttpStatus.TOO_MANY_REQUESTS
            );
        });
    });
});
