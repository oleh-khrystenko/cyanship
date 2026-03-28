import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { Request } from 'express';
import { RESPONSE_CODE } from '@cyanship/types';

import { REDIS_CLIENT } from '../../../common/providers/redis.provider';
import { ENV } from '../../../config/env';
import { User, UserDocument } from '../../users/schemas/user.schema';

const AI_IP_KEY_PREFIX = 'ai:ip:';
const AI_IP_TTL_SECONDS = 86_400; // 24 hours

@Injectable()
export class AiRateLimitGuard implements CanActivate {
    private readonly logger = new Logger(AiRateLimitGuard.name);

    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @Inject(REDIS_CLIENT)
        private readonly redis: Redis,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const user = request.user as UserDocument;

        await this.checkAccountLimit(user);
        await this.checkIpLimit(request);

        return true;
    }

    private async checkAccountLimit(user: UserDocument): Promise<void> {
        const ai = user.ai ?? { requestsUsed: 0, bonusGranted: false };
        const limit =
            ENV.AI_CHAT_FREE_LIMIT +
            (ai.bonusGranted ? ENV.AI_CHAT_BONUS_AMOUNT : 0);

        if (ai.requestsUsed >= limit) {
            throw new ForbiddenException({
                code: RESPONSE_CODE.AI_LIMIT_EXHAUSTED,
                message: 'AI request limit exhausted',
            });
        }
    }

    private async checkIpLimit(request: Request): Promise<void> {
        const ip =
            (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
            request.ip ||
            'unknown';

        const key = `${AI_IP_KEY_PREFIX}${ip}`;

        try {
            const count = await this.redis.incr(key);

            if (count === 1) {
                await this.redis.expire(key, AI_IP_TTL_SECONDS);
            }

            if (count > ENV.AI_CHAT_IP_LIMIT) {
                throw new HttpException(
                    {
                        code: RESPONSE_CODE.AI_RATE_LIMIT_EXCEEDED,
                        message: 'AI rate limit exceeded',
                    },
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }
        } catch (err) {
            if (err instanceof HttpException) throw err;

            this.logger.error(
                `Redis error during AI IP rate limit check: ${(err as Error).message}`,
            );
            throw new InternalServerErrorException(
                'AI service temporarily unavailable',
            );
        }
    }
}
