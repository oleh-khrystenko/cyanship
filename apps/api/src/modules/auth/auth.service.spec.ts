import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';

import { REDIS_CLIENT } from '../../common/providers/redis.provider';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { EmailService } from './services/email.service';

jest.mock('../../config/env', () => ({
    ENV: {
        JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        WEB_URL: 'http://localhost:3000',
        RESEND_API_KEY: 'test-resend-key',
        AUTH_LOCKOUT_THRESHOLDS: '5:1,10:5,20:15',
        AUTH_LOGIN_ATTEMPTS_TTL_MIN: 15,
    },
    parseLockoutThresholds: (raw: string) =>
        raw.split(',').map((entry: string) => {
            const [attempts, blockMin] = entry.split(':').map(Number);
            return { attempts, blockMin };
        }),
}));

jest.mock('bcrypt', () => ({
    compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

const mockUser = {
    id: '507f1f77bcf86cd799439011',
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    email: 'test@gmail.com',
    profile: { name: 'John Doe' },
    credits: { balance: 0, freeReportUsed: false },
    passwordHash: null as string | null,
    lastLoginAt: null as Date | null,
    save: jest.fn().mockImplementation(function (this: unknown) {
        return Promise.resolve(this);
    }),
};

const mockPipeline = {
    set: jest.fn().mockReturnThis(),
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
};

const mockRedis = {
    get: jest.fn(),
    getdel: jest.fn(),
    del: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    srem: jest.fn(),
    pipeline: jest.fn(),
    smembers: jest.fn(),
};

describe('AuthService', () => {
    let authService: AuthService;
    let jwtService: JwtService;
    let usersService: UsersService;
    let emailService: EmailService;

    beforeEach(async () => {
        mockRedis.pipeline.mockReturnValue(mockPipeline);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: JwtService,
                    useValue: {
                        signAsync: jest.fn(),
                        verifyAsync: jest.fn(),
                    },
                },
                {
                    provide: UsersService,
                    useValue: {
                        findByEmail: jest.fn(),
                        findOrCreateByGoogle: jest.fn(),
                        findOrCreateByEmail: jest.fn(),
                    },
                },
                {
                    provide: EmailService,
                    useValue: {
                        sendMagicLink: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: REDIS_CLIENT,
                    useValue: mockRedis,
                },
            ],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        jwtService = module.get<JwtService>(JwtService);
        usersService = module.get<UsersService>(UsersService);
        emailService = module.get<EmailService>(EmailService);
        jest.clearAllMocks();
        mockRedis.pipeline.mockReturnValue(mockPipeline);
    });

    describe('generateTokens', () => {
        it('should generate tokens and store refresh token in Redis', async () => {
            jest.spyOn(jwtService, 'signAsync')
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            const result = await authService.generateTokens(
                'user-id',
                'test@gmail.com'
            );

            expect(result).toEqual({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });
            expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

            // Access token payload should NOT have jti
            expect(jwtService.signAsync).toHaveBeenCalledWith(
                { sub: 'user-id', email: 'test@gmail.com' },
                expect.objectContaining({ expiresIn: '1h' })
            );

            // Refresh token payload should have jti
            expect(jwtService.signAsync).toHaveBeenCalledWith(
                {
                    sub: 'user-id',
                    email: 'test@gmail.com',
                    jti: expect.any(String),
                },
                expect.objectContaining({ expiresIn: '7d' })
            );

            // Verify Redis storage via pipeline
            expect(mockPipeline.set).toHaveBeenCalledWith(
                expect.stringMatching(/^refresh:[0-9a-f-]{36}$/),
                'user-id',
                'EX',
                604800
            );
            expect(mockPipeline.sadd).toHaveBeenCalledWith(
                'refresh_family:user-id',
                expect.any(String)
            );
            expect(mockPipeline.exec).toHaveBeenCalled();
        });
    });

    describe('rotateRefreshToken', () => {
        const validPayload = {
            sub: '507f1f77bcf86cd799439011',
            email: 'test@gmail.com',
            jti: 'old-jti-uuid',
        };

        it('should rotate token: atomically consume old, issue new pair', async () => {
            jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(
                validPayload
            );
            mockRedis.getdel.mockResolvedValue(validPayload.sub);
            jest.spyOn(jwtService, 'signAsync')
                .mockResolvedValueOnce('new-access-token')
                .mockResolvedValueOnce('new-refresh-token');

            const result =
                await authService.rotateRefreshToken('old-refresh-jwt');

            expect(result).toEqual({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            });
            expect(mockRedis.getdel).toHaveBeenCalledWith(
                'refresh:old-jti-uuid'
            );
            // Old token marked as rotated with grace period
            expect(mockRedis.set).toHaveBeenCalledWith(
                'refresh:old-jti-uuid',
                'rotated',
                'EX',
                10
            );
            expect(mockRedis.srem).toHaveBeenCalledWith(
                `refresh_family:${validPayload.sub}`,
                'old-jti-uuid'
            );
        });

        it('should throw on invalid JWT signature', async () => {
            jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(
                new Error('bad sig')
            );

            await expect(
                authService.rotateRefreshToken('bad-token')
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw on missing jti (legacy token)', async () => {
            jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
                sub: 'user-id',
                email: 'test@gmail.com',
            });

            await expect(
                authService.rotateRefreshToken('legacy-token')
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should revoke ALL user tokens on reuse detection', async () => {
            jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(
                validPayload
            );
            // jti NOT found in Redis — already consumed
            mockRedis.getdel.mockResolvedValue(null);
            mockRedis.smembers.mockResolvedValue(['jti-1', 'jti-2']);

            await expect(
                authService.rotateRefreshToken('reused-token')
            ).rejects.toThrow('Refresh token reuse detected');

            expect(mockRedis.smembers).toHaveBeenCalledWith(
                `refresh_family:${validPayload.sub}`
            );
            expect(mockPipeline.del).toHaveBeenCalledWith('refresh:jti-1');
            expect(mockPipeline.del).toHaveBeenCalledWith('refresh:jti-2');
            expect(mockPipeline.del).toHaveBeenCalledWith(
                `refresh_family:${validPayload.sub}`
            );
        });

        it('should throw on userId mismatch between JWT and Redis', async () => {
            jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(
                validPayload
            );
            mockRedis.getdel.mockResolvedValue('different-user-id');

            await expect(
                authService.rotateRefreshToken('token')
            ).rejects.toThrow('Token user mismatch');
        });

        it('should allow one concurrent refresh within grace period', async () => {
            jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(
                validPayload
            );
            mockRedis.getdel.mockResolvedValue('rotated');
            jest.spyOn(jwtService, 'signAsync')
                .mockResolvedValueOnce('new-access')
                .mockResolvedValueOnce('new-refresh');

            const result =
                await authService.rotateRefreshToken('concurrent-token');

            expect(result.accessToken).toBe('new-access');
            // Should NOT call smembers (no revocation)
            expect(mockRedis.smembers).not.toHaveBeenCalled();
        });
    });

    describe('revokeRefreshTokenByJwt', () => {
        it('should revoke token from Redis when valid', async () => {
            jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
                sub: 'user-id',
                email: 'test@gmail.com',
                jti: 'some-jti',
            });

            await authService.revokeRefreshTokenByJwt('valid-token');

            expect(mockPipeline.del).toHaveBeenCalledWith('refresh:some-jti');
            expect(mockPipeline.srem).toHaveBeenCalledWith(
                'refresh_family:user-id',
                'some-jti'
            );
        });

        it('should silently succeed for invalid/expired token', async () => {
            jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(
                new Error('expired')
            );

            await expect(
                authService.revokeRefreshTokenByJwt('expired-token')
            ).resolves.toBeUndefined();
        });

        it('should skip revocation for token without jti', async () => {
            jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
                sub: 'user-id',
                email: 'test@gmail.com',
            });

            await authService.revokeRefreshTokenByJwt('no-jti-token');

            expect(mockPipeline.del).not.toHaveBeenCalled();
        });
    });

    describe('revokeAllUserTokens', () => {
        it('should revoke all tokens for a user', async () => {
            mockRedis.smembers.mockResolvedValue(['jti-1', 'jti-2', 'jti-3']);

            await authService.revokeAllUserTokens('user-id');

            expect(mockRedis.smembers).toHaveBeenCalledWith(
                'refresh_family:user-id'
            );
            expect(mockPipeline.del).toHaveBeenCalledWith('refresh:jti-1');
            expect(mockPipeline.del).toHaveBeenCalledWith('refresh:jti-2');
            expect(mockPipeline.del).toHaveBeenCalledWith('refresh:jti-3');
            expect(mockPipeline.del).toHaveBeenCalledWith(
                'refresh_family:user-id'
            );
        });

        it('should handle user with no active tokens', async () => {
            mockRedis.smembers.mockResolvedValue([]);

            await authService.revokeAllUserTokens('user-id');

            expect(mockPipeline.del).not.toHaveBeenCalled();
        });
    });

    describe('handleGoogleAuth', () => {
        const googleProfile = {
            email: 'test@gmail.com',
            name: 'John Doe',
            avatar: 'https://photo.url',
            providerId: 'google-123',
        };

        it('should find or create user and generate tokens', async () => {
            jest.spyOn(usersService, 'findOrCreateByGoogle').mockResolvedValue(
                mockUser as never
            );
            jest.spyOn(jwtService, 'signAsync')
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            const result = await authService.handleGoogleAuth(googleProfile);

            expect(usersService.findOrCreateByGoogle).toHaveBeenCalledWith(
                googleProfile
            );
            expect(result.user).toBe(mockUser);
            expect(result.tokens).toEqual({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });
        });
    });

    describe('sendMagicLink', () => {
        const email = 'user@example.com';

        beforeEach(() => {
            mockRedis.get.mockResolvedValue(null);
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
        });

        it('should normalize email, generate token, store JSON in Redis, and send email', async () => {
            mockRedis.incr.mockResolvedValue(1);

            await authService.sendMagicLink('  User@Example.COM  ');

            expect(mockRedis.incr).toHaveBeenCalledWith(
                'ratelimit:magic:user@example.com'
            );
            expect(mockRedis.expire).toHaveBeenCalledWith(
                'ratelimit:magic:user@example.com',
                900
            );
            // Token payload stored as JSON via pipeline
            expect(mockPipeline.set).toHaveBeenCalledWith(
                expect.stringMatching(/^magic:[a-f0-9]{64}$/),
                expect.stringContaining('"email":"user@example.com"'),
                'EX',
                900
            );
            expect(emailService.sendMagicLink).toHaveBeenCalledWith(
                'user@example.com',
                expect.stringMatching(/^[a-f0-9]{64}$/),
                'login',
                'uk'
            );
        });

        it('should store purpose in Redis JSON payload', async () => {
            mockRedis.incr.mockResolvedValue(1);

            await authService.sendMagicLink(email, 'register');

            expect(mockPipeline.set).toHaveBeenCalledWith(
                expect.stringMatching(/^magic:/),
                JSON.stringify({ email, purpose: 'register' }),
                'EX',
                900
            );
        });

        it('should default purpose to login', async () => {
            mockRedis.incr.mockResolvedValue(1);

            await authService.sendMagicLink(email);

            expect(mockPipeline.set).toHaveBeenCalledWith(
                expect.stringMatching(/^magic:/),
                JSON.stringify({ email, purpose: 'login' }),
                'EX',
                900
            );
        });

        it('should not set expire on subsequent requests (count > 1)', async () => {
            mockRedis.incr.mockResolvedValue(2);

            await authService.sendMagicLink(email);

            expect(mockRedis.expire).not.toHaveBeenCalled();
            expect(emailService.sendMagicLink).toHaveBeenCalled();
        });

        it('should allow up to 3 requests within rate limit window', async () => {
            mockRedis.incr.mockResolvedValue(3);

            await authService.sendMagicLink(email);

            expect(emailService.sendMagicLink).toHaveBeenCalled();
        });

        it('should throw 429 when rate limit exceeded (4th request)', async () => {
            mockRedis.incr.mockResolvedValue(4);

            await expect(
                authService.sendMagicLink(email)
            ).rejects.toHaveProperty('status', HttpStatus.TOO_MANY_REQUESTS);
            expect(emailService.sendMagicLink).not.toHaveBeenCalled();
        });

        it('should throw 429 when rate limit is well over max', async () => {
            mockRedis.incr.mockResolvedValue(10);

            await expect(
                authService.sendMagicLink(email)
            ).rejects.toHaveProperty('status', HttpStatus.TOO_MANY_REQUESTS);
        });

        it('should not leak email in rate limit error message', async () => {
            mockRedis.incr.mockResolvedValue(4);

            await expect(
                authService.sendMagicLink('secret@example.com')
            ).rejects.toHaveProperty(
                'message',
                expect.not.stringContaining('secret@example.com') as string
            );
        });

        it('should skip sending email if dedup key exists (anti-spam)', async () => {
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.get.mockResolvedValue('existing-token');

            await authService.sendMagicLink(email);

            expect(emailService.sendMagicLink).not.toHaveBeenCalled();
        });

        it('should use user preferredLang for email when user exists', async () => {
            mockRedis.incr.mockResolvedValue(1);
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue({
                preferredLang: 'en',
            } as never);

            await authService.sendMagicLink(email);

            expect(emailService.sendMagicLink).toHaveBeenCalledWith(
                email,
                expect.any(String),
                'login',
                'en'
            );
        });
    });

    describe('verifyMagicLink', () => {
        const token = 'a'.repeat(64);

        it('should atomically consume token, create user, and return tokens + purpose', async () => {
            mockRedis.getdel.mockResolvedValue(
                JSON.stringify({ email: 'user@example.com', purpose: 'login' })
            );
            const saveMock = jest.fn().mockResolvedValue(mockUser);
            jest.spyOn(usersService, 'findOrCreateByEmail').mockResolvedValue({
                ...mockUser,
                save: saveMock,
            } as never);
            jest.spyOn(jwtService, 'signAsync')
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            const result = await authService.verifyMagicLink(token);

            expect(mockRedis.getdel).toHaveBeenCalledWith(`magic:${token}`);
            expect(usersService.findOrCreateByEmail).toHaveBeenCalledWith(
                'user@example.com'
            );
            expect(result.purpose).toBe('login');
            expect(result.tokens).toEqual({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });
        });

        it('should return correct purpose from Redis payload', async () => {
            mockRedis.getdel.mockResolvedValue(
                JSON.stringify({
                    email: 'user@example.com',
                    purpose: 'reset-password',
                })
            );
            const saveMock = jest.fn().mockResolvedValue(mockUser);
            jest.spyOn(usersService, 'findOrCreateByEmail').mockResolvedValue({
                ...mockUser,
                save: saveMock,
            } as never);
            jest.spyOn(jwtService, 'signAsync')
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            const result = await authService.verifyMagicLink(token);

            expect(result.purpose).toBe('reset-password');
        });

        it('should throw UnauthorizedException for invalid token', async () => {
            mockRedis.getdel.mockResolvedValue(null);

            await expect(
                authService.verifyMagicLink('invalid-token')
            ).rejects.toThrow('Invalid or expired magic link token');
        });

        it('should throw UnauthorizedException for expired token', async () => {
            mockRedis.getdel.mockResolvedValue(null);

            await expect(authService.verifyMagicLink(token)).rejects.toThrow(
                'Invalid or expired magic link token'
            );
        });
    });

    describe('checkEmail', () => {
        const ip = '192.168.1.1';

        beforeEach(() => {
            mockRedis.get.mockResolvedValue(null);
        });

        it('should return hasPassword: true for existing user with password', async () => {
            const userWithPassword = { ...mockUser, passwordHash: '$2b$10$hash' };
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(
                userWithPassword as never
            );

            const result = await authService.checkEmail('test@gmail.com', ip);

            expect(result).toEqual({ hasPassword: true, isNewUser: false });
        });

        it('should return hasPassword: false for existing user without password', async () => {
            const userNoPassword = { ...mockUser, passwordHash: null };
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(
                userNoPassword as never
            );

            const result = await authService.checkEmail('test@gmail.com', ip);

            expect(result).toEqual({ hasPassword: false, isNewUser: false });
        });

        it('should return isNewUser: true for non-existing user', async () => {
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

            const result = await authService.checkEmail('new@gmail.com', ip);

            expect(result).toEqual({ hasPassword: false, isNewUser: true });
        });

        it('should normalize email (trim + lowercase)', async () => {
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

            await authService.checkEmail('  Test@Gmail.COM  ', ip);

            expect(usersService.findByEmail).toHaveBeenCalledWith(
                'test@gmail.com'
            );
        });

        it('should allow up to 10 requests per IP', async () => {
            mockRedis.get.mockResolvedValue('9');
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

            await expect(
                authService.checkEmail('test@gmail.com', ip)
            ).resolves.toBeDefined();
        });

        it('should throw 429 on 11th request from same IP', async () => {
            mockRedis.get.mockResolvedValue('10');

            await expect(
                authService.checkEmail('test@gmail.com', ip)
            ).rejects.toHaveProperty('status', HttpStatus.TOO_MANY_REQUESTS);
        });
    });

    describe('loginWithPassword', () => {
        const ip = '192.168.1.1';
        const email = 'test@gmail.com';
        const password = 'securepass123';
        const hashedPassword = '$2b$10$hashedpassword';

        const userWithPassword = {
            ...mockUser,
            passwordHash: hashedPassword,
            save: jest.fn().mockImplementation(function (this: unknown) {
                return Promise.resolve(this);
            }),
        };

        beforeEach(() => {
            mockRedis.get.mockResolvedValue(null);
            mockUser.save.mockClear();
        });

        it('should return user and tokens on valid credentials', async () => {
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(
                userWithPassword as never
            );
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            jest.spyOn(jwtService, 'signAsync')
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            const result = await authService.loginWithPassword(
                email,
                password,
                ip
            );

            expect(result.user).toBe(userWithPassword);
            expect(result.accessToken).toBe('access-token');
            expect(result.refreshToken).toBe('refresh-token');
        });

        it('should throw 401 and increment attempts on invalid password', async () => {
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(
                userWithPassword as never
            );
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(
                authService.loginWithPassword(email, password, ip)
            ).rejects.toThrow('Invalid email or password');

            expect(mockPipeline.incr).toHaveBeenCalledWith(
                `login_attempts:${ip}:${email}`
            );
        });

        it('should throw 401 and increment attempts when user not found', async () => {
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

            await expect(
                authService.loginWithPassword(email, password, ip)
            ).rejects.toThrow('Invalid email or password');

            expect(mockPipeline.incr).toHaveBeenCalledWith(
                `login_attempts:${ip}:${email}`
            );
        });

        it('should throw 401 and increment attempts when user has no password', async () => {
            const userNoPassword = { ...mockUser, passwordHash: null };
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(
                userNoPassword as never
            );

            await expect(
                authService.loginWithPassword(email, password, ip)
            ).rejects.toThrow('Invalid email or password');

            expect(mockPipeline.incr).toHaveBeenCalledWith(
                `login_attempts:${ip}:${email}`
            );
        });

        it('should throw 429 after 5 failed attempts (1 min block)', async () => {
            mockRedis.get.mockResolvedValue('5');

            await expect(
                authService.loginWithPassword(email, password, ip)
            ).rejects.toHaveProperty('status', HttpStatus.TOO_MANY_REQUESTS);
        });

        it('should throw 429 after 10 failed attempts (5 min block)', async () => {
            mockRedis.get.mockResolvedValue('10');

            await expect(
                authService.loginWithPassword(email, password, ip)
            ).rejects.toMatchObject({
                status: HttpStatus.TOO_MANY_REQUESTS,
                message: expect.stringContaining('5 minutes') as string,
            });
        });

        it('should throw 429 after 20 failed attempts (15 min block)', async () => {
            mockRedis.get.mockResolvedValue('20');

            await expect(
                authService.loginWithPassword(email, password, ip)
            ).rejects.toMatchObject({
                status: HttpStatus.TOO_MANY_REQUESTS,
                message: expect.stringContaining('15 minutes') as string,
            });
        });

        it('should not block different IP for same email', async () => {
            mockRedis.get.mockResolvedValue(null);
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(
                userWithPassword as never
            );
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            jest.spyOn(jwtService, 'signAsync')
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            const result = await authService.loginWithPassword(
                email,
                password,
                '10.0.0.1'
            );

            expect(mockRedis.get).toHaveBeenCalledWith(
                `login_attempts:10.0.0.1:${email}`
            );
            expect(result.accessToken).toBe('access-token');
        });

        it('should clear login attempts on successful login', async () => {
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(
                userWithPassword as never
            );
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            jest.spyOn(jwtService, 'signAsync')
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            await authService.loginWithPassword(email, password, ip);

            expect(mockRedis.del).toHaveBeenCalledWith(
                `login_attempts:${ip}:${email}`
            );
        });

        it('should update lastLoginAt on successful login', async () => {
            jest.spyOn(usersService, 'findByEmail').mockResolvedValue(
                userWithPassword as never
            );
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            jest.spyOn(jwtService, 'signAsync')
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            await authService.loginWithPassword(email, password, ip);

            expect(userWithPassword.lastLoginAt).toBeInstanceOf(Date);
            expect(userWithPassword.save).toHaveBeenCalled();
        });
    });
});
