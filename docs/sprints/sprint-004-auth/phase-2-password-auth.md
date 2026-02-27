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

#### `checkEmail(email: string, ip: string)`

```typescript
async checkEmail(email: string, ip: string): Promise<{ hasPassword: boolean; isNewUser: boolean }> {
    // Rate limit per-IP (10 req/min)
    await this.checkEmailRateLimit(ip);

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);
    return {
        hasPassword: !!user?.passwordHash,
        isNewUser: !user,
    };
}

private async checkEmailRateLimit(ip: string): Promise<void> {
    const key = `check_email:${ip}`;
    const count = await this.redis.get(key);
    if (count && parseInt(count, 10) >= 10) {
        throw new TooManyRequestsException('Too many requests. Try again later');
    }
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, 60);
    await pipeline.exec();
}
```

#### `loginWithPassword(email: string, password: string, ip: string)`

```typescript
async loginWithPassword(email: string, password: string, ip: string) {
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
        user.email,
    );

    return { user, accessToken, refreshToken };
}
```

#### Progressive lockout (brute force protection)

Замість фіксованого ліміту — прогресивне блокування по зв'язці IP+email:

| Невдалих спроб | Блокування |
|----------------|------------|
| 5              | 1 хвилина  |
| 10             | 5 хвилин   |
| 20             | 15 хвилин  |

Конфігурується через `AUTH_LOCKOUT_THRESHOLDS=5:1,10:5,20:15`.

```typescript
private async checkBruteForce(ip: string, email: string): Promise<void> {
    const key = `login_attempts:${ip}:${email}`;
    const attemptsStr = await this.redis.get(key);
    if (!attemptsStr) return;

    const attempts = parseInt(attemptsStr, 10);
    const thresholds = parseLockoutThresholds(ENV.AUTH_LOCKOUT_THRESHOLDS);

    // Знайти найвищий поріг, який перевищено
    const activeThreshold = [...thresholds]
        .reverse()
        .find((t) => attempts >= t.attempts);

    if (activeThreshold) {
        throw new TooManyRequestsException(
            `Too many login attempts. Try again in ${activeThreshold.blockMin} minutes`,
        );
    }
}

private async incrementLoginAttempts(ip: string, email: string): Promise<void> {
    const key = `login_attempts:${ip}:${email}`;
    const ttl = ENV.AUTH_LOGIN_ATTEMPTS_TTL_MIN * 60;
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttl);
    await pipeline.exec();
}

private async clearLoginAttempts(ip: string, email: string): Promise<void> {
    const key = `login_attempts:${ip}:${email}`;
    await this.redis.del(key);
}
```

**Redis key:** `login_attempts:{ip}:{email}` → count (int), TTL = AUTH_LOGIN_ATTEMPTS_TTL_MIN * 60s

> **Чому IP+email:** Якщо ключ лише `{email}`, зловмисник може навмисно заблокувати вхід для легітимного юзера (DoS). Ключ `{ip}:{email}` блокує тільки конкретну пару — легітимний юзер з іншого IP продовжує входити.

---

## 2.3 Auth Controller — нові endpoints

### `apps/api/src/modules/auth/auth.controller.ts`

#### `POST /auth/check-email`

```typescript
@Post('check-email')
async checkEmail(@Body() dto: CheckEmailDto, @Req() req: Request) {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const result = await this.authService.checkEmail(dto.email, ip);
    return { data: result };
}
```

Response: `{ data: { hasPassword: boolean, isNewUser: boolean } }`

> **Rate limit:** 10 запитів per-IP за 1 хвилину. Запобігає масовому перебору email-адрес.

#### `POST /auth/login/password`

```typescript
@Post('login/password')
async loginWithPassword(@Body() dto: LoginPasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const { user, accessToken, refreshToken } = await this.authService.loginWithPassword(
        dto.email,
        dto.password,
        ip,
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
- Rate limit per-IP: 10 req → success, 11th → 429

**loginWithPassword:**
- Happy path: valid email + password → tokens + user
- Invalid password → 401 + increment attempts
- User not found → 401 + increment attempts
- User without password → 401 + increment attempts
- Progressive lockout: 5 спроб → 429 (1 хв block)
- Progressive lockout: 10 спроб → 429 (5 хв block)
- Progressive lockout: 20 спроб → 429 (15 хв block)
- Key format: `login_attempts:{ip}:{email}` (різні IP не блокують одне одного)
- Successful login clears attempts
- lastLoginAt updated

---

## Verification

1. `pnpm --filter api test` — всі тести pass (existing + new)
2. Manual: `POST /auth/check-email` з різними emails + rate limit per-IP
3. Manual: `POST /auth/login/password` — success, invalid, progressive lockout (5/10/20 спроб)
4. Manual: перевірити що різні IP не блокують одне одного для того самого email
