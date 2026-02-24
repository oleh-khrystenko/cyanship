# Фаза 2: Password Auth — check-email + login + brute force

> Залежить від: Фаза 1

## 2.1 DTOs

### `apps/api/src/modules/auth/dto/check-email.dto.ts` (new)

```typescript
import { createZodDto } from 'nestjs-zod';
import { CheckEmailSchema } from '@lucidkit/types';

export class CheckEmailDto extends createZodDto(CheckEmailSchema) {}
```

### `apps/api/src/modules/auth/dto/login-password.dto.ts` (new)

```typescript
import { createZodDto } from 'nestjs-zod';
import { LoginPasswordSchema } from '@lucidkit/types';

export class LoginPasswordDto extends createZodDto(LoginPasswordSchema) {}
```

---

## 2.2 Auth Service — нові методи

### `apps/api/src/modules/auth/auth.service.ts`

#### `checkEmail(email: string)`

```typescript
async checkEmail(email: string): Promise<{ hasPassword: boolean; isNewUser: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);
    return {
        hasPassword: !!user?.passwordHash,
        isNewUser: !user,
    };
}
```

#### `loginWithPassword(email: string, password: string)`

```typescript
async loginWithPassword(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check brute force
    await this.checkBruteForce(normalizedEmail);

    // 2. Find user
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
        await this.incrementLoginAttempts(normalizedEmail);
        throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Compare password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
        await this.incrementLoginAttempts(normalizedEmail);
        throw new UnauthorizedException('Invalid email or password');
    }

    // 4. Clear attempts on success
    await this.clearLoginAttempts(normalizedEmail);

    // 5. Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    // 6. Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(
        user._id.toString(),
        user.email,
    );

    return { user, accessToken, refreshToken };
}
```

#### Brute force protection

```typescript
private async checkBruteForce(email: string): Promise<void> {
    const key = `login_attempts:${email}`;
    const attempts = await this.redis.get(key);
    if (attempts && parseInt(attempts, 10) >= ENV.AUTH_MAX_LOGIN_ATTEMPTS) {
        throw new TooManyRequestsException(
            `Too many login attempts. Try again in ${ENV.AUTH_LOGIN_BLOCK_DURATION_MIN} minutes`,
        );
    }
}

private async incrementLoginAttempts(email: string): Promise<void> {
    const key = `login_attempts:${email}`;
    const ttl = ENV.AUTH_LOGIN_BLOCK_DURATION_MIN * 60;
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttl);
    await pipeline.exec();
}

private async clearLoginAttempts(email: string): Promise<void> {
    const key = `login_attempts:${email}`;
    await this.redis.del(key);
}
```

**Redis key:** `login_attempts:{email}` → count (int), TTL = AUTH_LOGIN_BLOCK_DURATION_MIN * 60s

---

## 2.3 Auth Controller — нові endpoints

### `apps/api/src/modules/auth/auth.controller.ts`

#### `POST /auth/check-email`

```typescript
@Post('check-email')
async checkEmail(@Body() dto: CheckEmailDto) {
    const result = await this.authService.checkEmail(dto.email);
    return { data: result };
}
```

Response: `{ data: { hasPassword: boolean, isNewUser: boolean } }`

#### `POST /auth/login/password`

```typescript
@Post('login/password')
async loginWithPassword(@Body() dto: LoginPasswordDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.authService.loginWithPassword(
        dto.email,
        dto.password,
    );

    res.cookie('bid_refresh', refreshToken, {
        httpOnly: true,
        secure: ENV.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
        data: {
            user: {
                id: user._id,
                email: user.email,
                profile: user.profile,
                credits: user.credits,
                preferredLang: user.preferredLang,
                hasPassword: !!user.passwordHash,
                deletedAt: user.deletedAt ?? null,
            },
            accessToken,
        },
    };
}
```

---

## 2.4 Users Service — password hash methods

### `apps/api/src/modules/users/users.service.ts`

```typescript
async setPasswordHash(userId: string, hash: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { passwordHash: hash });
}

async clearPasswordHash(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { passwordHash: null });
}
```

---

## 2.5 Тести

### `apps/api/src/modules/auth/auth.service.spec.ts`

Додати тест-кейси:

**checkEmail:**
- Existing user з password → `{ hasPassword: true, isNewUser: false }`
- Existing user без password → `{ hasPassword: false, isNewUser: false }`
- New user → `{ hasPassword: false, isNewUser: true }`
- Email normalization (trim + lowercase)

**loginWithPassword:**
- Happy path: valid email + password → tokens + user
- Invalid password → 401 + increment attempts
- User not found → 401 + increment attempts
- User without password → 401 + increment attempts
- Brute force block (>= MAX attempts) → 429
- Successful login clears attempts
- lastLoginAt updated

---

## Verification

1. `pnpm --filter api test` — всі тести pass (existing + new)
2. Manual: `POST /auth/check-email` з різними emails
3. Manual: `POST /auth/login/password` — success, invalid, brute force
