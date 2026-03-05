import { randomBytes, randomUUID } from 'crypto';

import * as bcrypt from 'bcrypt';
import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
    LANG,
    MAGIC_LINK_PURPOSE,
    type MagicLinkPurpose,
} from '@lucidkit/types';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../common/providers/redis.provider';
import { ENV, parseLockoutThresholds } from '../../config/env';
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

const REFRESH_TOKEN_TTL = 2 * 60; // [TEST] 2 minutes — production: 7 * 24 * 60 * 60
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
                expiresIn: '1m', // [TEST] 1 minute — production: '1h'
            }),
            this.jwtService.signAsync(refreshPayload, {
                secret: ENV.JWT_REFRESH_SECRET,
                expiresIn: '2m', // [TEST] 2 minutes — production: '7d'
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

        // Atomic consume: GETDEL ensures only one request can use the token
        const storedValue = await this.redis.getdel(`refresh:${jti}`);

        if (!storedValue) {
            // Token reuse detected — revoke ALL tokens for this user
            await this.revokeAllUserTokens(userId);
            throw new UnauthorizedException('Refresh token reuse detected');
        }

        if (storedValue === 'rotated') {
            // Grace period: one extra use allowed for concurrent tab
            return this.generateTokens(userId, email);
        }

        if (storedValue !== userId) {
            throw new UnauthorizedException('Token user mismatch');
        }

        // Mark old token as rotated with short grace period (one-time use via GETDEL above)
        await this.redis.set(
            `refresh:${jti}`,
            'rotated',
            'EX',
            ROTATION_GRACE_PERIOD
        );
        await this.redis.srem(`refresh_family:${userId}`, jti);

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
    ): Promise<{
        user: UserDocument;
        tokens: TokenPair;
        accountDeleted?: boolean;
    }> {
        const user =
            await this.usersService.findOrCreateByGoogle(googleProfile);
        const tokens = await this.generateTokens(user.id as string, user.email);

        return {
            user,
            tokens,
            accountDeleted: user.deletedAt ? true : undefined,
        };
    }

    async sendMagicLink(
        email: string,
        purpose: MagicLinkPurpose = MAGIC_LINK_PURPOSE.LOGIN
    ): Promise<void> {
        const normalizedEmail = email.trim().toLowerCase();
        const rateLimitKey = `ratelimit:magic:${normalizedEmail}`;
        const rateLimitTtl = ENV.AUTH_MAGIC_LINK_RATE_WINDOW_MIN * 60;

        const count = await this.redis.incr(rateLimitKey);

        if (count === 1) {
            await this.redis.expire(rateLimitKey, rateLimitTtl);
        }

        if (count > ENV.AUTH_MAGIC_LINK_RATE_LIMIT) {
            throw new TooManyRequestsException();
        }

        // Anti-spam dedup: skip sending if recent token exists for same email+purpose
        const dedupKey = `magic_dedup:${normalizedEmail}:${purpose}`;
        const existingDedup = await this.redis.get(dedupKey);
        if (existingDedup) {
            return;
        }

        const token = randomBytes(32).toString('hex');
        const payload = JSON.stringify({ email: normalizedEmail, purpose });
        const magicLinkTtl = ENV.AUTH_MAGIC_LINK_TTL_MIN * 60;

        const pipeline = this.redis.pipeline();
        pipeline.set(`magic:${token}`, payload, 'EX', magicLinkTtl);
        pipeline.set(dedupKey, token, 'EX', ENV.AUTH_MAGIC_LINK_DEDUP_SEC);
        await pipeline.exec();

        const user = await this.usersService.findByEmail(normalizedEmail);
        const lang = user?.preferredLang ?? LANG.UK;

        await this.emailService.sendMagicLink(
            normalizedEmail,
            token,
            purpose,
            lang
        );
    }

    async verifyMagicLink(
        token: string
    ): Promise<
        | {
              user: UserDocument;
              tokens: TokenPair;
              purpose: MagicLinkPurpose;
              deleted?: false;
              accountDeleted?: boolean;
          }
        | {
              deleted: true;
              message: string;
              purpose: typeof MAGIC_LINK_PURPOSE.DELETE_ACCOUNT;
          }
    > {
        const magicKey = `magic:${token}`;
        const raw = await this.redis.getdel(magicKey);

        if (!raw) {
            throw new UnauthorizedException(
                'Invalid or expired magic link token'
            );
        }

        const { email, purpose } = JSON.parse(raw) as {
            email: string;
            purpose: MagicLinkPurpose;
        };

        if (purpose === MAGIC_LINK_PURPOSE.DELETE_ACCOUNT) {
            return this.handleDeleteAccountVerification(email);
        }

        const user = await this.usersService.findOrCreateByEmail(email);

        user.lastLoginAt = new Date();
        await user.save();

        const tokens = await this.generateTokens(
            user._id.toString(),
            user.email
        );

        return {
            user,
            tokens,
            purpose,
            accountDeleted: user.deletedAt ? true : undefined,
        };
    }

    async sendDeletionConfirmationEmail(
        email: string,
        lang: string
    ): Promise<void> {
        const deletionDate = new Date();
        deletionDate.setDate(
            deletionDate.getDate() + ENV.ACCOUNT_DELETION_GRACE_DAYS
        );
        await this.emailService.sendDeletionConfirmation(
            email,
            deletionDate,
            lang
        );
    }

    private async handleDeleteAccountVerification(
        email: string
    ): Promise<{
        deleted: true;
        message: string;
        purpose: typeof MAGIC_LINK_PURPOSE.DELETE_ACCOUNT;
    }> {
        const user = await this.usersService.findByEmail(email);
        if (!user) throw new NotFoundException('User not found');

        await this.usersService.softDelete(user._id.toString());
        await this.revokeAllUserTokens(user._id.toString());
        await this.sendDeletionConfirmationEmail(email, user.preferredLang);

        return {
            deleted: true,
            message: 'Account scheduled for deletion',
            purpose: MAGIC_LINK_PURPOSE.DELETE_ACCOUNT,
        };
    }

    async checkEmail(
        email: string,
        ip: string
    ): Promise<{ hasPassword: boolean; isNewUser: boolean }> {
        await this.checkEmailRateLimit(ip);

        const normalizedEmail = email.trim().toLowerCase();
        const user = await this.usersService.findByEmail(normalizedEmail);
        return {
            hasPassword: !!user?.passwordHash,
            isNewUser: !user,
        };
    }

    async loginWithPassword(
        email: string,
        password: string,
        ip: string
    ): Promise<{
        user: UserDocument;
        accessToken: string;
        refreshToken: string;
        accountDeleted?: boolean;
    }> {
        const normalizedEmail = email.trim().toLowerCase();

        // 1. Check progressive lockout (IP+email)
        await this.checkBruteForce(ip, normalizedEmail);

        // 2. Find user
        const user = await this.usersService.findByEmail(normalizedEmail);
        if (!user || !user.passwordHash) {
            await this.incrementLoginAttempts(ip, normalizedEmail);
            throw new UnauthorizedException('Invalid email or password');
        }

        // 3. Compare password
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            await this.incrementLoginAttempts(ip, normalizedEmail);
            throw new UnauthorizedException('Invalid email or password');
        }

        // 4. Clear attempts on success
        await this.clearLoginAttempts(ip, normalizedEmail);

        // 5. Update lastLoginAt
        user.lastLoginAt = new Date();
        await user.save();

        // 6. Generate tokens
        const { accessToken, refreshToken } = await this.generateTokens(
            user._id.toString(),
            user.email
        );

        return {
            user,
            accessToken,
            refreshToken,
            accountDeleted: user.deletedAt ? true : undefined,
        };
    }

    async setPassword(userId: string, password: string): Promise<void> {
        const user = await this.usersService.findById(userId);
        if (!user) throw new NotFoundException('User not found');
        if (user.passwordHash) {
            throw new BadRequestException(
                'Password already set. Use change password instead.'
            );
        }
        const hash = await bcrypt.hash(password, 10);
        await this.usersService.setPasswordHash(userId, hash);
    }

    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string
    ): Promise<TokenPair> {
        const user = await this.usersService.findById(userId);
        if (!user || !user.passwordHash) {
            throw new BadRequestException('No password set');
        }
        const isValid = await bcrypt.compare(
            currentPassword,
            user.passwordHash
        );
        if (!isValid) {
            throw new UnauthorizedException('Invalid current password');
        }
        const hash = await bcrypt.hash(newPassword, 10);
        await this.usersService.setPasswordHash(userId, hash);

        // Invalidate all other sessions
        await this.revokeAllUserTokens(userId);

        // Issue new token pair for current session
        return this.generateTokens(userId, user.email);
    }

    async deletePassword(userId: string): Promise<void> {
        const user = await this.usersService.findById(userId);
        if (!user || !user.passwordHash) {
            throw new BadRequestException('No password to delete');
        }
        await this.usersService.clearPasswordHash(userId);
    }

    async verifyPassword(
        userId: string,
        password: string
    ): Promise<boolean> {
        const user = await this.usersService.findById(userId);
        if (!user || !user.passwordHash) return false;
        return bcrypt.compare(password, user.passwordHash);
    }

    private async checkEmailRateLimit(ip: string): Promise<void> {
        const key = `check_email:${ip}`;
        const count = await this.redis.get(key);
        if (count && parseInt(count, 10) >= 10) {
            throw new TooManyRequestsException(
                'Too many requests. Try again later'
            );
        }
        const pipeline = this.redis.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, 60);
        await pipeline.exec();
    }

    private async checkBruteForce(
        ip: string,
        email: string
    ): Promise<void> {
        const key = `login_attempts:${ip}:${email}`;
        const attemptsStr = await this.redis.get(key);
        if (!attemptsStr) return;

        const attempts = parseInt(attemptsStr, 10);
        const thresholds = parseLockoutThresholds(
            ENV.AUTH_LOCKOUT_THRESHOLDS
        );

        // Find the highest threshold that has been exceeded
        const activeThreshold = [...thresholds]
            .reverse()
            .find((t) => attempts >= t.attempts);

        if (activeThreshold) {
            throw new TooManyRequestsException(
                `Too many login attempts. Try again in ${activeThreshold.blockMin} minutes`
            );
        }
    }

    private async incrementLoginAttempts(
        ip: string,
        email: string
    ): Promise<void> {
        const key = `login_attempts:${ip}:${email}`;
        const ttl = ENV.AUTH_LOGIN_ATTEMPTS_TTL_MIN * 60;
        const pipeline = this.redis.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, ttl);
        await pipeline.exec();
    }

    private async clearLoginAttempts(
        ip: string,
        email: string
    ): Promise<void> {
        const key = `login_attempts:${ip}:${email}`;
        await this.redis.del(key);
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
    constructor(message = 'Too many requests. Try again in 15 minutes.') {
        super(message, HttpStatus.TOO_MANY_REQUESTS);
    }
}
