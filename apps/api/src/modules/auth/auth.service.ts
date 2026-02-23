import { randomBytes, randomUUID } from 'crypto';

import {
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../common/providers/redis.provider';
import { ENV } from '../../config/env';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { EmailService } from './services/email.service';
import { GoogleValidatedUser } from './strategies/google.strategy';

interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

interface JwtPayload {
    sub: string;
    email: string;
    jti?: string;
}

const MAGIC_LINK_TTL = 900; // 15 minutes
const RATE_LIMIT_TTL = 900; // 15 minutes
const RATE_LIMIT_MAX = 3;
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const ROTATION_GRACE_PERIOD = 10; // 10 seconds for concurrent tab requests

@Injectable()
export class AuthService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly usersService: UsersService,
        private readonly emailService: EmailService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis
    ) {}

    async generateTokens(userId: string, email: string): Promise<TokenPair> {
        const jti = randomUUID();
        const accessPayload: JwtPayload = { sub: userId, email };
        const refreshPayload: JwtPayload = { sub: userId, email, jti };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(accessPayload, {
                secret: ENV.JWT_ACCESS_SECRET,
                expiresIn: '1h',
            }),
            this.jwtService.signAsync(refreshPayload, {
                secret: ENV.JWT_REFRESH_SECRET,
                expiresIn: '7d',
            }),
        ]);

        await this.storeRefreshToken(userId, jti);

        return { accessToken, refreshToken };
    }

    async rotateRefreshToken(token: string): Promise<TokenPair> {
        let payload: JwtPayload;

        try {
            payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
                secret: ENV.JWT_REFRESH_SECRET,
            });
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const { sub: userId, email, jti } = payload;

        if (!jti) {
            throw new UnauthorizedException('Invalid refresh token format');
        }

        const storedValue = await this.redis.get(`refresh:${jti}`);

        if (!storedValue) {
            // Token reuse detected — revoke ALL tokens for this user
            await this.revokeAllUserTokens(userId);
            throw new UnauthorizedException('Refresh token reuse detected');
        }

        if (storedValue === 'rotated') {
            // Grace period: another tab already rotated this token
            return this.generateTokens(userId, email);
        }

        if (storedValue !== userId) {
            throw new UnauthorizedException('Token user mismatch');
        }

        // Mark old token as rotated with short grace period
        const pipeline = this.redis.pipeline();
        pipeline.set(`refresh:${jti}`, 'rotated', 'EX', ROTATION_GRACE_PERIOD);
        pipeline.srem(`refresh_family:${userId}`, jti);
        await pipeline.exec();

        return this.generateTokens(userId, email);
    }

    async revokeAllUserTokens(userId: string): Promise<void> {
        const jtis = await this.redis.smembers(`refresh_family:${userId}`);

        if (jtis.length > 0) {
            const pipeline = this.redis.pipeline();
            for (const jti of jtis) {
                pipeline.del(`refresh:${jti}`);
            }
            pipeline.del(`refresh_family:${userId}`);
            await pipeline.exec();
        }
    }

    async revokeRefreshTokenByJwt(token: string): Promise<void> {
        try {
            const payload = await this.jwtService.verifyAsync<JwtPayload>(
                token,
                { secret: ENV.JWT_REFRESH_SECRET }
            );

            if (payload.jti) {
                await this.revokeRefreshToken(payload.jti, payload.sub);
            }
        } catch {
            // Token is invalid/expired — nothing to revoke
        }
    }

    async handleGoogleAuth(
        googleProfile: GoogleValidatedUser
    ): Promise<{ user: UserDocument; tokens: TokenPair }> {
        const user =
            await this.usersService.findOrCreateByGoogle(googleProfile);
        const tokens = await this.generateTokens(user.id as string, user.email);

        return { user, tokens };
    }

    async sendMagicLink(email: string): Promise<void> {
        const normalizedEmail = email.trim().toLowerCase();
        const rateLimitKey = `ratelimit:magic:${normalizedEmail}`;

        const count = await this.redis.incr(rateLimitKey);

        if (count === 1) {
            await this.redis.expire(rateLimitKey, RATE_LIMIT_TTL);
        }

        if (count > RATE_LIMIT_MAX) {
            throw new TooManyRequestsException();
        }

        const token = randomBytes(32).toString('hex');
        const magicKey = `magic:${token}`;

        await this.redis.set(magicKey, normalizedEmail, 'EX', MAGIC_LINK_TTL);

        await this.emailService.sendMagicLink(normalizedEmail, token);
    }

    async verifyMagicLink(
        token: string
    ): Promise<{ user: UserDocument; tokens: TokenPair }> {
        const magicKey = `magic:${token}`;
        const email = await this.redis.getdel(magicKey);

        if (!email) {
            throw new UnauthorizedException(
                'Invalid or expired magic link token'
            );
        }

        const user = await this.usersService.findOrCreateByEmail(email);
        const tokens = await this.generateTokens(user.id as string, user.email);

        return { user, tokens };
    }

    private async storeRefreshToken(
        userId: string,
        jti: string
    ): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.set(`refresh:${jti}`, userId, 'EX', REFRESH_TOKEN_TTL);
        pipeline.sadd(`refresh_family:${userId}`, jti);
        pipeline.expire(`refresh_family:${userId}`, REFRESH_TOKEN_TTL);
        await pipeline.exec();
    }

    private async revokeRefreshToken(
        jti: string,
        userId: string
    ): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.del(`refresh:${jti}`);
        pipeline.srem(`refresh_family:${userId}`, jti);
        await pipeline.exec();
    }
}

class TooManyRequestsException extends HttpException {
    constructor() {
        super(
            'Too many requests. Try again in 15 minutes.',
            HttpStatus.TOO_MANY_REQUESTS
        );
    }
}
