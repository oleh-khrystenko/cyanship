# Automated Tests: Unit + Integration

> Повне покриття auth flow. Unit тести мокують залежності, integration тести використовують MongoMemoryServer + mocked Redis.

## Інфраструктура

### Існуюча (sprint-003)

- `auth.service.spec.ts` — 40+ test cases (magic link, token refresh, rotation, reuse detection)
- `users.service.spec.ts` — 18 test cases (CRUD, findOrCreate, credits)
- `app.e2e-spec.ts` — E2E з MongoMemoryServer + mocked Redis

### Нові залежності для тестів

```bash
pnpm --filter api add -D bcrypt  # вже є як dependency, потрібен для мокування
```

### Мокування

```typescript
// Redis mock (розширити існуючий)
const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getdel: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    pipeline: jest.fn(() => ({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        sadd: jest.fn().mockReturnThis(),
        srem: jest.fn().mockReturnThis(),
        smembers: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
    })),
    smembers: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn(),
};

// bcrypt mock
jest.mock('bcrypt', () => ({
    hash: jest.fn().mockResolvedValue('$2b$10$hashedPassword'),
    compare: jest.fn(),
}));
```

---

## 1. Unit тести: auth.service.spec.ts

### 1.1 checkEmail

```typescript
describe('checkEmail', () => {
    const ip = '127.0.0.1';

    it('should return hasPassword=true for user with password', async () => {
        usersService.findByEmail.mockResolvedValue({
            email: 'user@test.com',
            passwordHash: '$2b$10$hash',
        });
        const result = await authService.checkEmail('user@test.com', ip);
        expect(result).toEqual({ hasPassword: true, isNewUser: false });
    });

    it('should return hasPassword=false for user without password', async () => {
        usersService.findByEmail.mockResolvedValue({
            email: 'user@test.com',
            passwordHash: null,
        });
        const result = await authService.checkEmail('user@test.com', ip);
        expect(result).toEqual({ hasPassword: false, isNewUser: false });
    });

    it('should return isNewUser=true for unknown email', async () => {
        usersService.findByEmail.mockResolvedValue(null);
        const result = await authService.checkEmail('new@test.com', ip);
        expect(result).toEqual({ hasPassword: false, isNewUser: true });
    });

    it('should normalize email (trim + lowercase)', async () => {
        usersService.findByEmail.mockResolvedValue(null);
        await authService.checkEmail('  User@Test.COM  ', ip);
        expect(usersService.findByEmail).toHaveBeenCalledWith('user@test.com');
    });

    describe('rate limit per-IP', () => {
        it('should allow up to 10 requests from same IP', async () => {
            mockRedis.get.mockResolvedValue('9');
            usersService.findByEmail.mockResolvedValue(null);
            await expect(authService.checkEmail('a@test.com', ip)).resolves.toBeDefined();
        });

        it('should throw 429 on 11th request from same IP', async () => {
            mockRedis.get.mockResolvedValue('10');
            await expect(authService.checkEmail('a@test.com', ip))
                .rejects.toThrow(TooManyRequestsException);
        });

        it('should use check_email:{ip} as Redis key', async () => {
            mockRedis.get.mockResolvedValue(null);
            usersService.findByEmail.mockResolvedValue(null);
            await authService.checkEmail('a@test.com', '192.168.1.1');
            expect(mockRedis.get).toHaveBeenCalledWith('check_email:192.168.1.1');
        });

        it('should not block different IPs', async () => {
            mockRedis.get
                .mockResolvedValueOnce('10')  // IP1 blocked
                .mockResolvedValueOnce('0');   // IP2 not blocked
            await expect(authService.checkEmail('a@test.com', 'ip1'))
                .rejects.toThrow(TooManyRequestsException);
            usersService.findByEmail.mockResolvedValue(null);
            await expect(authService.checkEmail('a@test.com', 'ip2'))
                .resolves.toBeDefined();
        });
    });
});
```

---

### 1.2 loginWithPassword

```typescript
describe('loginWithPassword', () => {
    const ip = '127.0.0.1';
    const email = 'user@test.com';
    const password = 'password123';

    const mockUser = {
        _id: { toString: () => 'userId123' },
        email,
        passwordHash: '$2b$10$hash',
        lastLoginAt: null,
        save: jest.fn(),
    };

    beforeEach(() => {
        mockRedis.get.mockResolvedValue(null); // no lockout
        bcrypt.compare.mockResolvedValue(true);
    });

    it('should return user + tokens on valid credentials', async () => {
        usersService.findByEmail.mockResolvedValue(mockUser);
        const result = await authService.loginWithPassword(email, password, ip);
        expect(result).toHaveProperty('user');
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
    });

    it('should normalize email before lookup', async () => {
        usersService.findByEmail.mockResolvedValue(mockUser);
        await authService.loginWithPassword('  User@Test.COM  ', password, ip);
        expect(usersService.findByEmail).toHaveBeenCalledWith('user@test.com');
    });

    it('should update lastLoginAt on success', async () => {
        usersService.findByEmail.mockResolvedValue(mockUser);
        await authService.loginWithPassword(email, password, ip);
        expect(mockUser.lastLoginAt).toBeInstanceOf(Date);
        expect(mockUser.save).toHaveBeenCalled();
    });

    it('should clear login attempts on success', async () => {
        usersService.findByEmail.mockResolvedValue(mockUser);
        await authService.loginWithPassword(email, password, ip);
        expect(mockRedis.del).toHaveBeenCalledWith(`login_attempts:${ip}:${email}`);
    });

    describe('invalid credentials', () => {
        it('should throw 401 on invalid password', async () => {
            usersService.findByEmail.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(false);
            await expect(authService.loginWithPassword(email, 'wrong', ip))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw 401 when user not found', async () => {
            usersService.findByEmail.mockResolvedValue(null);
            await expect(authService.loginWithPassword('no@test.com', password, ip))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should throw 401 when user has no password', async () => {
            usersService.findByEmail.mockResolvedValue({ ...mockUser, passwordHash: null });
            await expect(authService.loginWithPassword(email, password, ip))
                .rejects.toThrow(UnauthorizedException);
        });

        it('should increment login attempts on failure', async () => {
            usersService.findByEmail.mockResolvedValue(null);
            try { await authService.loginWithPassword(email, password, ip); } catch {}
            const pipeline = mockRedis.pipeline();
            expect(pipeline.incr).toHaveBeenCalledWith(`login_attempts:${ip}:${email}`);
        });
    });
});
```

---

### 1.3 Progressive lockout

```typescript
describe('progressive lockout', () => {
    const ip = '127.0.0.1';
    const email = 'user@test.com';

    it('should allow login with 4 failed attempts (below first threshold)', async () => {
        mockRedis.get.mockResolvedValue('4');
        usersService.findByEmail.mockResolvedValue({ ...mockUser });
        bcrypt.compare.mockResolvedValue(true);
        await expect(authService.loginWithPassword(email, 'pass', ip))
            .resolves.toBeDefined();
    });

    it('should throw 429 at 5 attempts (1 min block)', async () => {
        mockRedis.get.mockResolvedValue('5');
        await expect(authService.loginWithPassword(email, 'pass', ip))
            .rejects.toThrow(TooManyRequestsException);
        // Verify message contains "1 minute"
    });

    it('should throw 429 at 10 attempts (5 min block)', async () => {
        mockRedis.get.mockResolvedValue('10');
        await expect(authService.loginWithPassword(email, 'pass', ip))
            .rejects.toThrow(TooManyRequestsException);
    });

    it('should throw 429 at 20 attempts (15 min block)', async () => {
        mockRedis.get.mockResolvedValue('20');
        await expect(authService.loginWithPassword(email, 'pass', ip))
            .rejects.toThrow(TooManyRequestsException);
    });

    it('should use login_attempts:{ip}:{email} as key', async () => {
        mockRedis.get.mockResolvedValue('5');
        try { await authService.loginWithPassword(email, 'pass', ip); } catch {}
        expect(mockRedis.get).toHaveBeenCalledWith(`login_attempts:${ip}:${email}`);
    });

    it('should not cross-block different IPs for same email', async () => {
        // IP1 has 20 attempts, IP2 has 0
        mockRedis.get
            .mockResolvedValueOnce('20')  // checkBruteForce for IP1
            .mockResolvedValueOnce(null); // checkBruteForce for IP2
        await expect(authService.loginWithPassword(email, 'pass', '1.1.1.1'))
            .rejects.toThrow(TooManyRequestsException);

        usersService.findByEmail.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        await expect(authService.loginWithPassword(email, 'pass', '2.2.2.2'))
            .resolves.toBeDefined();
    });

    it('should not cross-block different emails for same IP', async () => {
        mockRedis.get
            .mockResolvedValueOnce('20')  // email1
            .mockResolvedValueOnce(null); // email2
        await expect(authService.loginWithPassword('a@test.com', 'pass', ip))
            .rejects.toThrow(TooManyRequestsException);

        usersService.findByEmail.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        await expect(authService.loginWithPassword('b@test.com', 'pass', ip))
            .resolves.toBeDefined();
    });

    it('should set TTL = AUTH_LOGIN_ATTEMPTS_TTL_MIN * 60 on increment', async () => {
        mockRedis.get.mockResolvedValue(null);
        usersService.findByEmail.mockResolvedValue(null);
        try { await authService.loginWithPassword(email, 'pass', ip); } catch {}
        const pipeline = mockRedis.pipeline();
        expect(pipeline.expire).toHaveBeenCalledWith(
            `login_attempts:${ip}:${email}`,
            ENV.AUTH_LOGIN_ATTEMPTS_TTL_MIN * 60,
        );
    });
});
```

---

### 1.4 sendMagicLink з purpose + anti-spam dedup

```typescript
describe('sendMagicLink', () => {
    const email = 'user@test.com';

    beforeEach(() => {
        mockRedis.get.mockResolvedValue(null); // no rate limit, no dedup
        usersService.findByEmail.mockResolvedValue({ preferredLang: 'uk' });
    });

    it('should default purpose to "login"', async () => {
        await authService.sendMagicLink(email);
        const pipeline = mockRedis.pipeline();
        const setCall = pipeline.set.mock.calls[0];
        const payload = JSON.parse(setCall[1]);
        expect(payload.purpose).toBe('login');
    });

    it('should store purpose in Redis as JSON', async () => {
        await authService.sendMagicLink(email, 'register');
        const pipeline = mockRedis.pipeline();
        const setCall = pipeline.set.mock.calls[0];
        const payload = JSON.parse(setCall[1]);
        expect(payload).toEqual({ email: 'user@test.com', purpose: 'register' });
    });

    it('should pass purpose and lang to email service', async () => {
        await authService.sendMagicLink(email, 'reset-password');
        expect(emailService.sendMagicLink).toHaveBeenCalledWith(
            'user@test.com',
            expect.any(String), // token
            'reset-password',
            'uk',
        );
    });

    it('should use user.preferredLang for email (fallback to uk)', async () => {
        usersService.findByEmail.mockResolvedValue({ preferredLang: 'en' });
        await authService.sendMagicLink(email, 'login');
        expect(emailService.sendMagicLink).toHaveBeenCalledWith(
            expect.any(String), expect.any(String), 'login', 'en',
        );
    });

    it('should use "uk" when user not found (new user)', async () => {
        usersService.findByEmail.mockResolvedValue(null);
        await authService.sendMagicLink(email, 'register');
        expect(emailService.sendMagicLink).toHaveBeenCalledWith(
            expect.any(String), expect.any(String), 'register', 'uk',
        );
    });

    it('should rate limit per-email (not per-purpose)', async () => {
        // Rate limit is checked before purpose is used
        mockRedis.get
            .mockResolvedValueOnce(null)  // dedup check
            .mockResolvedValueOnce('3');   // rate limit (3 = max)
        await expect(authService.sendMagicLink(email, 'login'))
            .rejects.toThrow(TooManyRequestsException);
    });

    describe('anti-spam dedup', () => {
        it('should not send email if dedup key exists (< 60s)', async () => {
            // First call for dedup key check
            mockRedis.get.mockResolvedValueOnce('existing_token'); // dedup exists
            await authService.sendMagicLink(email, 'login');
            expect(emailService.sendMagicLink).not.toHaveBeenCalled();
        });

        it('should return success without sending (no error)', async () => {
            mockRedis.get.mockResolvedValueOnce('existing_token');
            await expect(authService.sendMagicLink(email, 'login'))
                .resolves.toBeUndefined();
        });

        it('should send email if dedup key expired (> 60s)', async () => {
            mockRedis.get
                .mockResolvedValueOnce(null)  // dedup key expired
                .mockResolvedValueOnce(null); // rate limit ok
            await authService.sendMagicLink(email, 'login');
            expect(emailService.sendMagicLink).toHaveBeenCalled();
        });

        it('should set dedup key with AUTH_MAGIC_LINK_DEDUP_SEC TTL', async () => {
            mockRedis.get.mockResolvedValue(null);
            await authService.sendMagicLink(email, 'login');
            const pipeline = mockRedis.pipeline();
            expect(pipeline.set).toHaveBeenCalledWith(
                `magic_dedup:user@test.com:login`,
                expect.any(String),
                'EX',
                ENV.AUTH_MAGIC_LINK_DEDUP_SEC,
            );
        });

        it('should use separate dedup keys per email+purpose', async () => {
            mockRedis.get.mockResolvedValue(null);
            await authService.sendMagicLink(email, 'login');
            await authService.sendMagicLink(email, 'reset-password');
            // Both should send (different purposes, different dedup keys)
            expect(emailService.sendMagicLink).toHaveBeenCalledTimes(2);
        });
    });
});
```

---

### 1.5 verifyMagicLink з purpose

```typescript
describe('verifyMagicLink', () => {
    it('should return user + purpose for login', async () => {
        mockRedis.getdel.mockResolvedValue(JSON.stringify({
            email: 'user@test.com', purpose: 'login',
        }));
        usersService.findOrCreateByEmail.mockResolvedValue(mockUser);
        const result = await authService.verifyMagicLink('token123');
        expect(result.purpose).toBe('login');
        expect(result).toHaveProperty('accessToken');
    });

    it('should return user + purpose for register', async () => {
        mockRedis.getdel.mockResolvedValue(JSON.stringify({
            email: 'new@test.com', purpose: 'register',
        }));
        usersService.findOrCreateByEmail.mockResolvedValue(mockUser);
        const result = await authService.verifyMagicLink('token123');
        expect(result.purpose).toBe('register');
    });

    it('should return user + purpose for reset-password', async () => {
        mockRedis.getdel.mockResolvedValue(JSON.stringify({
            email: 'user@test.com', purpose: 'reset-password',
        }));
        usersService.findOrCreateByEmail.mockResolvedValue(mockUser);
        const result = await authService.verifyMagicLink('token123');
        expect(result.purpose).toBe('reset-password');
    });

    it('should execute soft delete for delete-account purpose', async () => {
        mockRedis.getdel.mockResolvedValue(JSON.stringify({
            email: 'user@test.com', purpose: 'delete-account',
        }));
        usersService.findByEmail.mockResolvedValue(mockUser);
        const result = await authService.verifyMagicLink('token123');
        expect(usersService.softDelete).toHaveBeenCalledWith('userId123');
        expect(result).toHaveProperty('deleted', true);
    });

    it('should revoke all tokens on delete-account', async () => {
        mockRedis.getdel.mockResolvedValue(JSON.stringify({
            email: 'user@test.com', purpose: 'delete-account',
        }));
        usersService.findByEmail.mockResolvedValue(mockUser);
        await authService.verifyMagicLink('token123');
        expect(authService.revokeAllUserTokens).toHaveBeenCalledWith('userId123');
    });

    it('should send deletion confirmation email', async () => {
        mockRedis.getdel.mockResolvedValue(JSON.stringify({
            email: 'user@test.com', purpose: 'delete-account',
        }));
        usersService.findByEmail.mockResolvedValue({ ...mockUser, preferredLang: 'uk' });
        await authService.verifyMagicLink('token123');
        expect(emailService.sendDeletionConfirmation).toHaveBeenCalledWith(
            'user@test.com',
            expect.any(Date),
            'uk',
        );
    });

    it('should throw 401 on invalid/expired token', async () => {
        mockRedis.getdel.mockResolvedValue(null);
        await expect(authService.verifyMagicLink('bad_token'))
            .rejects.toThrow(UnauthorizedException);
    });

    it('should update lastLoginAt on successful verify', async () => {
        mockRedis.getdel.mockResolvedValue(JSON.stringify({
            email: 'user@test.com', purpose: 'login',
        }));
        usersService.findOrCreateByEmail.mockResolvedValue(mockUser);
        await authService.verifyMagicLink('token123');
        expect(mockUser.lastLoginAt).toBeInstanceOf(Date);
        expect(mockUser.save).toHaveBeenCalled();
    });
});
```

---

### 1.6 Password management

```typescript
describe('setPassword', () => {
    it('should hash and save password for user without password', async () => {
        usersService.findById.mockResolvedValue({ passwordHash: null });
        await authService.setPassword('userId', 'newpass123');
        expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 10);
        expect(usersService.setPasswordHash).toHaveBeenCalledWith('userId', '$2b$10$hashedPassword');
    });

    it('should throw 400 if user already has password', async () => {
        usersService.findById.mockResolvedValue({ passwordHash: '$2b$10$existing' });
        await expect(authService.setPassword('userId', 'newpass'))
            .rejects.toThrow(BadRequestException);
    });

    it('should throw 404 if user not found', async () => {
        usersService.findById.mockResolvedValue(null);
        await expect(authService.setPassword('no_id', 'newpass'))
            .rejects.toThrow(NotFoundException);
    });
});

describe('changePassword', () => {
    const user = {
        _id: { toString: () => 'userId' },
        email: 'user@test.com',
        passwordHash: '$2b$10$old',
    };

    it('should change password and return new tokens', async () => {
        usersService.findById.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        const result = await authService.changePassword('userId', 'oldpass', 'newpass');
        expect(bcrypt.hash).toHaveBeenCalledWith('newpass', 10);
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
    });

    it('should revoke all user tokens (session invalidation)', async () => {
        usersService.findById.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        await authService.changePassword('userId', 'oldpass', 'newpass');
        expect(authService.revokeAllUserTokens).toHaveBeenCalledWith('userId');
    });

    it('should generate new tokens after revocation', async () => {
        usersService.findById.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(true);
        const result = await authService.changePassword('userId', 'oldpass', 'newpass');
        // revokeAllUserTokens called before generateTokens
        const revokeOrder = authService.revokeAllUserTokens.mock.invocationCallOrder[0];
        const generateOrder = authService.generateTokens.mock.invocationCallOrder[0];
        expect(revokeOrder).toBeLessThan(generateOrder);
    });

    it('should throw 401 on invalid current password', async () => {
        usersService.findById.mockResolvedValue(user);
        bcrypt.compare.mockResolvedValue(false);
        await expect(authService.changePassword('userId', 'wrong', 'newpass'))
            .rejects.toThrow(UnauthorizedException);
    });

    it('should throw 400 when no password set', async () => {
        usersService.findById.mockResolvedValue({ ...user, passwordHash: null });
        await expect(authService.changePassword('userId', 'old', 'new'))
            .rejects.toThrow(BadRequestException);
    });
});

describe('deletePassword', () => {
    it('should clear passwordHash for user with password', async () => {
        usersService.findById.mockResolvedValue({ passwordHash: '$2b$10$hash' });
        await authService.deletePassword('userId');
        expect(usersService.clearPasswordHash).toHaveBeenCalledWith('userId');
    });

    it('should throw 400 when no password to delete', async () => {
        usersService.findById.mockResolvedValue({ passwordHash: null });
        await expect(authService.deletePassword('userId'))
            .rejects.toThrow(BadRequestException);
    });
});

describe('verifyPassword', () => {
    it('should return true for valid password', async () => {
        usersService.findById.mockResolvedValue({ passwordHash: '$2b$10$hash' });
        bcrypt.compare.mockResolvedValue(true);
        expect(await authService.verifyPassword('userId', 'correct')).toBe(true);
    });

    it('should return false for invalid password', async () => {
        usersService.findById.mockResolvedValue({ passwordHash: '$2b$10$hash' });
        bcrypt.compare.mockResolvedValue(false);
        expect(await authService.verifyPassword('userId', 'wrong')).toBe(false);
    });

    it('should return false when no password set', async () => {
        usersService.findById.mockResolvedValue({ passwordHash: null });
        expect(await authService.verifyPassword('userId', 'any')).toBe(false);
    });

    it('should return false when user not found', async () => {
        usersService.findById.mockResolvedValue(null);
        expect(await authService.verifyPassword('noId', 'any')).toBe(false);
    });
});
```

---

### 1.7 Account deletion (handleDeleteAccountVerification)

```typescript
describe('handleDeleteAccountVerification', () => {
    it('should soft delete user', async () => {
        usersService.findByEmail.mockResolvedValue(mockUser);
        await authService.handleDeleteAccountVerification('user@test.com');
        expect(usersService.softDelete).toHaveBeenCalledWith('userId123');
    });

    it('should revoke all user tokens', async () => {
        usersService.findByEmail.mockResolvedValue(mockUser);
        await authService.handleDeleteAccountVerification('user@test.com');
        expect(authService.revokeAllUserTokens).toHaveBeenCalledWith('userId123');
    });

    it('should send deletion confirmation email', async () => {
        usersService.findByEmail.mockResolvedValue({ ...mockUser, preferredLang: 'en' });
        await authService.handleDeleteAccountVerification('user@test.com');
        expect(emailService.sendDeletionConfirmation).toHaveBeenCalledWith(
            'user@test.com',
            expect.any(Date), // deletion date = now + 30 days
            'en',
        );
    });

    it('should throw 404 when user not found', async () => {
        usersService.findByEmail.mockResolvedValue(null);
        await expect(authService.handleDeleteAccountVerification('no@test.com'))
            .rejects.toThrow(NotFoundException);
    });
});
```

---

### 1.8 Login з deleted account

```typescript
describe('login with deleted account', () => {
    const deletedUser = {
        ...mockUser,
        deletedAt: new Date('2025-12-01'),
    };

    it('should return accountDeleted=true for password login', async () => {
        mockRedis.get.mockResolvedValue(null);
        usersService.findByEmail.mockResolvedValue(deletedUser);
        bcrypt.compare.mockResolvedValue(true);
        const result = await authService.loginWithPassword('user@test.com', 'pass', '127.0.0.1');
        expect(result.accountDeleted).toBe(true);
        expect(result.deletedAt).toEqual(deletedUser.deletedAt);
    });

    it('should still generate tokens for deleted account (for recovery)', async () => {
        mockRedis.get.mockResolvedValue(null);
        usersService.findByEmail.mockResolvedValue(deletedUser);
        bcrypt.compare.mockResolvedValue(true);
        const result = await authService.loginWithPassword('user@test.com', 'pass', '127.0.0.1');
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
    });

    it('should return accountDeleted=true for magic link verify', async () => {
        mockRedis.getdel.mockResolvedValue(JSON.stringify({
            email: 'user@test.com', purpose: 'login',
        }));
        usersService.findOrCreateByEmail.mockResolvedValue(deletedUser);
        const result = await authService.verifyMagicLink('token');
        expect(result.accountDeleted).toBe(true);
    });
});
```

---

## 2. Unit тести: users.service.spec.ts

### 2.1 Password hash methods

```typescript
describe('setPasswordHash', () => {
    it('should update passwordHash field', async () => {
        await usersService.setPasswordHash('userId', '$2b$10$hash');
        expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
            'userId',
            { passwordHash: '$2b$10$hash' },
        );
    });
});

describe('clearPasswordHash', () => {
    it('should set passwordHash to null', async () => {
        await usersService.clearPasswordHash('userId');
        expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
            'userId',
            { passwordHash: null },
        );
    });
});
```

### 2.2 Account methods

```typescript
describe('softDelete', () => {
    it('should set deletedAt to current date', async () => {
        const before = Date.now();
        await usersService.softDelete('userId');
        const call = userModel.findByIdAndUpdate.mock.calls[0];
        expect(call[1].deletedAt).toBeInstanceOf(Date);
        expect(call[1].deletedAt.getTime()).toBeGreaterThanOrEqual(before);
    });
});

describe('restore', () => {
    it('should set deletedAt to null', async () => {
        await usersService.restore('userId');
        expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
            'userId',
            { deletedAt: null },
        );
    });
});

describe('updateProfile', () => {
    it('should update profile.name', async () => {
        await usersService.updateProfile('userId', { name: 'John' });
        expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
            'userId',
            { 'profile.name': 'John' },
            { new: true },
        );
    });

    it('should update profile.avatar', async () => {
        await usersService.updateProfile('userId', { avatar: 'https://img.com/a.jpg' });
        expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
            'userId',
            { 'profile.avatar': 'https://img.com/a.jpg' },
            { new: true },
        );
    });

    it('should update preferredLang', async () => {
        await usersService.updateProfile('userId', { preferredLang: 'en' });
        expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
            'userId',
            { preferredLang: 'en' },
            { new: true },
        );
    });

    it('should only update provided fields (partial)', async () => {
        await usersService.updateProfile('userId', { name: 'Jane' });
        const updateArg = userModel.findByIdAndUpdate.mock.calls[0][1];
        expect(updateArg).toEqual({ 'profile.name': 'Jane' });
        expect(updateArg).not.toHaveProperty('profile.avatar');
        expect(updateArg).not.toHaveProperty('preferredLang');
    });
});
```

---

## 3. Unit тести: email.service.spec.ts

```typescript
describe('EmailService', () => {
    describe('sendMagicLink', () => {
        it('should use register template (UK)', async () => {
            await emailService.sendMagicLink('u@t.com', 'token', 'register', 'uk');
            expect(resendMock.emails.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Ласкаво просимо до LucidKit',
                    to: 'u@t.com',
                }),
            );
        });

        it('should use register template (EN)', async () => {
            await emailService.sendMagicLink('u@t.com', 'token', 'register', 'en');
            expect(resendMock.emails.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Welcome to LucidKit',
                }),
            );
        });

        it('should use login template', async () => {
            await emailService.sendMagicLink('u@t.com', 'token', 'login', 'uk');
            expect(resendMock.emails.send).toHaveBeenCalledWith(
                expect.objectContaining({ subject: 'Вхід до LucidKit' }),
            );
        });

        it('should use reset-password template', async () => {
            await emailService.sendMagicLink('u@t.com', 'token', 'reset-password', 'uk');
            expect(resendMock.emails.send).toHaveBeenCalledWith(
                expect.objectContaining({ subject: 'Скидання пароля' }),
            );
        });

        it('should use delete-account template', async () => {
            await emailService.sendMagicLink('u@t.com', 'token', 'delete-account', 'uk');
            expect(resendMock.emails.send).toHaveBeenCalledWith(
                expect.objectContaining({ subject: 'Підтвердження видалення акаунту' }),
            );
        });

        it('should include token in link', async () => {
            await emailService.sendMagicLink('u@t.com', 'abc123', 'login', 'uk');
            const html = resendMock.emails.send.mock.calls[0][0].html;
            expect(html).toContain('token=abc123');
        });

        it('should fallback to UK if unknown lang', async () => {
            await emailService.sendMagicLink('u@t.com', 'token', 'login', 'fr');
            expect(resendMock.emails.send).toHaveBeenCalledWith(
                expect.objectContaining({ subject: 'Вхід до LucidKit' }),
            );
        });
    });

    describe('sendDeletionConfirmation', () => {
        it('should send UK confirmation email', async () => {
            const date = new Date('2026-04-01');
            await emailService.sendDeletionConfirmation('u@t.com', date, 'uk');
            const call = resendMock.emails.send.mock.calls[0][0];
            expect(call.to).toBe('u@t.com');
            expect(call.html).toContain('01.04.2026'); // or similar date format
        });

        it('should send EN confirmation email', async () => {
            const date = new Date('2026-04-01');
            await emailService.sendDeletionConfirmation('u@t.com', date, 'en');
            expect(resendMock.emails.send).toHaveBeenCalledWith(
                expect.objectContaining({ to: 'u@t.com' }),
            );
        });

        it('should include recovery instructions', async () => {
            const date = new Date('2026-04-01');
            await emailService.sendDeletionConfirmation('u@t.com', date, 'uk');
            const html = resendMock.emails.send.mock.calls[0][0].html;
            expect(html).toContain(ENV.WEB_URL); // link to sign in
        });
    });
});
```

---

## 4. Integration/E2E тести: app.e2e-spec.ts

> Розширити існуючий E2E файл. MongoMemoryServer + mocked Redis.

### 4.1 POST /auth/check-email

```typescript
describe('POST /api/auth/check-email', () => {
    it('new user → { hasPassword: false, isNewUser: true }', () =>
        request(app.getHttpServer())
            .post('/api/auth/check-email')
            .send({ email: 'new@test.com' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data).toEqual({ hasPassword: false, isNewUser: true });
            }));

    it('existing user with password → { hasPassword: true, isNewUser: false }', async () => {
        // Setup: create user with password
        await createUserWithPassword('exist@test.com', 'pass123');
        return request(app.getHttpServer())
            .post('/api/auth/check-email')
            .send({ email: 'exist@test.com' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.hasPassword).toBe(true);
                expect(res.body.data.isNewUser).toBe(false);
            });
    });

    it('existing user without password → { hasPassword: false, isNewUser: false }', async () => {
        await createUserWithoutPassword('nopass@test.com');
        return request(app.getHttpServer())
            .post('/api/auth/check-email')
            .send({ email: 'nopass@test.com' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.hasPassword).toBe(false);
                expect(res.body.data.isNewUser).toBe(false);
            });
    });

    it('invalid email format → 400', () =>
        request(app.getHttpServer())
            .post('/api/auth/check-email')
            .send({ email: 'not-an-email' })
            .expect(400));

    it('rate limit → 429 after 10 requests from same IP', async () => {
        for (let i = 0; i < 10; i++) {
            await request(app.getHttpServer())
                .post('/api/auth/check-email')
                .send({ email: `test${i}@test.com` })
                .expect(200);
        }
        return request(app.getHttpServer())
            .post('/api/auth/check-email')
            .send({ email: 'extra@test.com' })
            .expect(429);
    });
});
```

### 4.2 POST /auth/login/password

```typescript
describe('POST /api/auth/login/password', () => {
    beforeEach(async () => {
        await createUserWithPassword('user@test.com', 'correct123');
    });

    it('valid credentials → 200 + user + accessToken + cookie', () =>
        request(app.getHttpServer())
            .post('/api/auth/login/password')
            .send({ email: 'user@test.com', password: 'correct123' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data).toHaveProperty('accessToken');
                expect(res.body.data.user).toHaveProperty('email', 'user@test.com');
                expect(res.body.data.user).toHaveProperty('hasPassword', true);
                expect(res.headers['set-cookie']).toBeDefined();
            }));

    it('invalid password → 401', () =>
        request(app.getHttpServer())
            .post('/api/auth/login/password')
            .send({ email: 'user@test.com', password: 'wrong' })
            .expect(401));

    it('nonexistent email → 401', () =>
        request(app.getHttpServer())
            .post('/api/auth/login/password')
            .send({ email: 'nobody@test.com', password: 'any' })
            .expect(401));

    it('user without password → 401', async () => {
        await createUserWithoutPassword('nopass@test.com');
        return request(app.getHttpServer())
            .post('/api/auth/login/password')
            .send({ email: 'nopass@test.com', password: 'any' })
            .expect(401);
    });

    it('progressive lockout → 429 after 5 attempts', async () => {
        for (let i = 0; i < 5; i++) {
            await request(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'user@test.com', password: 'wrong' })
                .expect(401);
        }
        return request(app.getHttpServer())
            .post('/api/auth/login/password')
            .send({ email: 'user@test.com', password: 'wrong' })
            .expect(429);
    });

    it('successful login clears attempts counter', async () => {
        // 3 failed attempts
        for (let i = 0; i < 3; i++) {
            await request(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'user@test.com', password: 'wrong' });
        }
        // Successful login
        await request(app.getHttpServer())
            .post('/api/auth/login/password')
            .send({ email: 'user@test.com', password: 'correct123' })
            .expect(200);
        // 5 more failed attempts should work (counter reset)
        for (let i = 0; i < 4; i++) {
            await request(app.getHttpServer())
                .post('/api/auth/login/password')
                .send({ email: 'user@test.com', password: 'wrong' })
                .expect(401);
        }
    });

    it('deleted account → 200 + accountDeleted: true', async () => {
        await softDeleteUser('user@test.com');
        return request(app.getHttpServer())
            .post('/api/auth/login/password')
            .send({ email: 'user@test.com', password: 'correct123' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.accountDeleted).toBe(true);
                expect(res.body.data.deletedAt).toBeDefined();
            });
    });
});
```

### 4.3 POST /auth/magic-link/send (з purpose + dedup)

```typescript
describe('POST /api/auth/magic-link/send', () => {
    it('default purpose = login', () =>
        request(app.getHttpServer())
            .post('/api/auth/magic-link/send')
            .send({ email: 'user@test.com' })
            .expect(200));

    it('explicit purpose = register', () =>
        request(app.getHttpServer())
            .post('/api/auth/magic-link/send')
            .send({ email: 'user@test.com', purpose: 'register' })
            .expect(200));

    it('explicit purpose = reset-password', () =>
        request(app.getHttpServer())
            .post('/api/auth/magic-link/send')
            .send({ email: 'user@test.com', purpose: 'reset-password' })
            .expect(200));

    it('explicit purpose = delete-account', () =>
        request(app.getHttpServer())
            .post('/api/auth/magic-link/send')
            .send({ email: 'user@test.com', purpose: 'delete-account' })
            .expect(200));

    it('rate limiting → 429 after 3 requests', async () => {
        for (let i = 0; i < 3; i++) {
            await request(app.getHttpServer())
                .post('/api/auth/magic-link/send')
                .send({ email: 'spam@test.com' })
                .expect(200);
        }
        return request(app.getHttpServer())
            .post('/api/auth/magic-link/send')
            .send({ email: 'spam@test.com' })
            .expect(429);
    });

    it('anti-spam dedup → 200 without sending on repeat within 60s', async () => {
        await request(app.getHttpServer())
            .post('/api/auth/magic-link/send')
            .send({ email: 'user@test.com' })
            .expect(200);
        // Second call within 60s — should return 200 but not send email
        await request(app.getHttpServer())
            .post('/api/auth/magic-link/send')
            .send({ email: 'user@test.com' })
            .expect(200);
        // Verify email sent only once (via email service mock)
    });
});
```

### 4.4 POST /auth/magic-link/verify (з purpose)

```typescript
describe('POST /api/auth/magic-link/verify', () => {
    it('purpose=login → user + accessToken + purpose', async () => {
        const token = await createMagicLinkToken('user@test.com', 'login');
        return request(app.getHttpServer())
            .post('/api/auth/magic-link/verify')
            .send({ token })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.purpose).toBe('login');
                expect(res.body.data).toHaveProperty('accessToken');
            });
    });

    it('purpose=register → user + accessToken + purpose', async () => {
        const token = await createMagicLinkToken('new@test.com', 'register');
        return request(app.getHttpServer())
            .post('/api/auth/magic-link/verify')
            .send({ token })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.purpose).toBe('register');
            });
    });

    it('purpose=reset-password → user + accessToken + purpose', async () => {
        const token = await createMagicLinkToken('user@test.com', 'reset-password');
        return request(app.getHttpServer())
            .post('/api/auth/magic-link/verify')
            .send({ token })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.purpose).toBe('reset-password');
            });
    });

    it('purpose=delete-account → soft delete + no tokens', async () => {
        await createUserWithoutPassword('del@test.com');
        const token = await createMagicLinkToken('del@test.com', 'delete-account');
        return request(app.getHttpServer())
            .post('/api/auth/magic-link/verify')
            .send({ token })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.deleted).toBe(true);
            });
    });

    it('invalid token → 401', () =>
        request(app.getHttpServer())
            .post('/api/auth/magic-link/verify')
            .send({ token: 'invalid_token_123' })
            .expect(401));

    it('expired token → 401', async () => {
        // Token was deleted from Redis (expired)
        return request(app.getHttpServer())
            .post('/api/auth/magic-link/verify')
            .send({ token: 'expired_token' })
            .expect(401);
    });
});
```

### 4.5 POST /auth/password/*

```typescript
describe('POST /api/auth/password/set', () => {
    it('set password (no existing) → 200', async () => {
        const { accessToken } = await loginAsMagicLink('nopass@test.com');
        return request(app.getHttpServer())
            .post('/api/auth/password/set')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ password: 'newpass123' })
            .expect(200);
    });

    it('set password (already exists) → 400', async () => {
        const { accessToken } = await loginWithPassword('haspass@test.com');
        return request(app.getHttpServer())
            .post('/api/auth/password/set')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ password: 'another' })
            .expect(400);
    });

    it('no auth → 401', () =>
        request(app.getHttpServer())
            .post('/api/auth/password/set')
            .send({ password: 'test1234' })
            .expect(401));
});

describe('POST /api/auth/password/change', () => {
    it('valid current + new → 200 + new accessToken + cookie', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'oldpass');
        return request(app.getHttpServer())
            .post('/api/auth/password/change')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ currentPassword: 'oldpass', newPassword: 'newpass123' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data).toHaveProperty('accessToken');
                expect(res.headers['set-cookie']).toBeDefined();
            });
    });

    it('invalid current → 401', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'correct');
        return request(app.getHttpServer())
            .post('/api/auth/password/change')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ currentPassword: 'wrong', newPassword: 'newpass' })
            .expect(401);
    });

    it('session invalidation → old refresh token stops working', async () => {
        const { accessToken, refreshCookie } = await loginWithPassword('user@test.com', 'pass');
        // Change password
        await request(app.getHttpServer())
            .post('/api/auth/password/change')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ currentPassword: 'pass', newPassword: 'newpass' })
            .expect(200);
        // Old refresh token should be invalid
        return request(app.getHttpServer())
            .post('/api/auth/refresh')
            .set('Cookie', refreshCookie)
            .expect(401);
    });

    it('no auth → 401', () =>
        request(app.getHttpServer())
            .post('/api/auth/password/change')
            .send({ currentPassword: 'a', newPassword: 'b' })
            .expect(401));
});

describe('POST /api/auth/password/delete', () => {
    it('has password → 200', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'pass');
        return request(app.getHttpServer())
            .post('/api/auth/password/delete')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);
    });

    it('no password → 400', async () => {
        const { accessToken } = await loginAsMagicLink('nopass@test.com');
        return request(app.getHttpServer())
            .post('/api/auth/password/delete')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(400);
    });

    it('no auth → 401', () =>
        request(app.getHttpServer())
            .post('/api/auth/password/delete')
            .expect(401));
});

describe('POST /api/auth/password/verify', () => {
    it('valid password → { isValid: true }', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'pass');
        return request(app.getHttpServer())
            .post('/api/auth/password/verify')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ password: 'pass' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.isValid).toBe(true);
            });
    });

    it('invalid password → { isValid: false }', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'pass');
        return request(app.getHttpServer())
            .post('/api/auth/password/verify')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ password: 'wrong' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.isValid).toBe(false);
            });
    });

    it('no auth → 401', () =>
        request(app.getHttpServer())
            .post('/api/auth/password/verify')
            .send({ password: 'any' })
            .expect(401));
});
```

### 4.6 Account management

```typescript
describe('POST /api/users/account/delete', () => {
    it('user with password → { requiresPassword: true }', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'pass');
        return request(app.getHttpServer())
            .post('/api/users/account/delete')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200)
            .expect((res) => {
                expect(res.body.data.requiresPassword).toBe(true);
            });
    });

    it('user without password → { requiresMagicLink: true }', async () => {
        const { accessToken } = await loginAsMagicLink('nopass@test.com');
        return request(app.getHttpServer())
            .post('/api/users/account/delete')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200)
            .expect((res) => {
                expect(res.body.data.requiresMagicLink).toBe(true);
            });
    });

    it('no auth → 401', () =>
        request(app.getHttpServer())
            .post('/api/users/account/delete')
            .expect(401));
});

describe('POST /api/users/account/delete/confirm', () => {
    it('valid password → soft delete + clear cookie', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'pass');
        return request(app.getHttpServer())
            .post('/api/users/account/delete/confirm')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ password: 'pass' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.message).toContain('deletion');
                // Cookie cleared
                const cookies = res.headers['set-cookie'];
                expect(cookies).toBeDefined();
            });
    });

    it('invalid password → 401', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'pass');
        return request(app.getHttpServer())
            .post('/api/users/account/delete/confirm')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ password: 'wrong' })
            .expect(401);
    });

    it('no auth → 401', () =>
        request(app.getHttpServer())
            .post('/api/users/account/delete/confirm')
            .send({ password: 'any' })
            .expect(401));
});

describe('POST /api/users/account/restore', () => {
    it('deleted account → restore → 200', async () => {
        const { accessToken } = await loginAsDeletedUser('user@test.com');
        return request(app.getHttpServer())
            .post('/api/users/account/restore')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);
    });

    it('non-deleted account → 400', async () => {
        const { accessToken } = await loginWithPassword('active@test.com', 'pass');
        return request(app.getHttpServer())
            .post('/api/users/account/restore')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(400);
    });

    it('no auth → 401', () =>
        request(app.getHttpServer())
            .post('/api/users/account/restore')
            .expect(401));
});
```

### 4.7 PATCH /users/me

```typescript
describe('PATCH /api/users/me', () => {
    it('update name → 200 + updated profile', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'pass');
        return request(app.getHttpServer())
            .patch('/api/users/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ name: 'New Name' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.profile.name).toBe('New Name');
            });
    });

    it('update avatar → 200', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'pass');
        return request(app.getHttpServer())
            .patch('/api/users/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ avatar: 'https://img.com/new.jpg' })
            .expect(200);
    });

    it('update preferredLang → 200', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'pass');
        return request(app.getHttpServer())
            .patch('/api/users/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ preferredLang: 'en' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.preferredLang).toBe('en');
            });
    });

    it('partial update → only provided fields change', async () => {
        const { accessToken } = await loginWithPassword('user@test.com', 'pass');
        // Set initial name
        await request(app.getHttpServer())
            .patch('/api/users/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ name: 'Original' });
        // Update only lang
        return request(app.getHttpServer())
            .patch('/api/users/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ preferredLang: 'en' })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.profile.name).toBe('Original'); // unchanged
                expect(res.body.data.preferredLang).toBe('en');
            });
    });

    it('no auth → 401', () =>
        request(app.getHttpServer())
            .patch('/api/users/me')
            .send({ name: 'test' })
            .expect(401));
});
```

### 4.8 Existing endpoints (regression)

```typescript
describe('Existing auth endpoints (regression)', () => {
    describe('POST /api/auth/refresh', () => {
        it('valid refresh cookie → 200 + new tokens');
        it('invalid refresh cookie → 401');
        it('rotation: old cookie stops working after grace period');
        it('reuse detection: revokes all user tokens');
        it('grace period: old cookie works within 10s');
    });

    describe('POST /api/auth/logout', () => {
        it('valid session → 200 + clear cookie');
        it('revokes refresh token in Redis');
    });

    describe('GET /api/users/me', () => {
        it('valid JWT → 200 + user profile (includes hasPassword, deletedAt)');
        it('no auth → 401');
        it('expired JWT → 401');
    });
});
```

---

## 5. Зведена таблиця: кількість тест-кейсів

| Файл | Unit | Integration | Total |
|------|------|-------------|-------|
| auth.service.spec.ts | ~65 | — | ~65 |
| users.service.spec.ts | ~10 | — | ~10 |
| email.service.spec.ts | ~9 | — | ~9 |
| app.e2e-spec.ts | — | ~45 | ~45 |
| **Total** | **~84** | **~45** | **~129** |

---

## Verification

1. `pnpm --filter api test` — всі unit тести pass
2. `pnpm --filter api test:e2e` — всі integration тести pass
3. `pnpm --filter api test:cov` — coverage report, target: >80% для auth + users modules
