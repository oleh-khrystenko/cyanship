# Фаза 4: Password Management

> Залежить від: Фаза 2 + Фаза 3

## 4.1 DTOs

### `apps/api/src/modules/auth/dto/set-password.dto.ts` (new)

```typescript
import { createZodDto } from 'nestjs-zod';
import { SetPasswordSchema } from '@lucidship/types';

export class SetPasswordDto extends createZodDto(SetPasswordSchema) {}
```

### `apps/api/src/modules/auth/dto/change-password.dto.ts` (new)

```typescript
import { createZodDto } from 'nestjs-zod';
import { ChangePasswordSchema } from '@lucidship/types';

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
```

### `apps/api/src/modules/auth/dto/verify-password.dto.ts` (new)

```typescript
import { createZodDto } from 'nestjs-zod';
import { VerifyPasswordSchema } from '@lucidship/types';

export class VerifyPasswordDto extends createZodDto(VerifyPasswordSchema) {}
```

---

## 4.2 Auth Service — password methods

### `apps/api/src/modules/auth/auth.service.ts`

#### `setPassword(userId, password)`

Встановити пароль вперше (user без пароля):

```typescript
async setPassword(userId: string, password: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.passwordHash) {
        throw new BadRequestException('Password already set. Use change password instead.');
    }
    const hash = await bcrypt.hash(password, 10);
    await this.usersService.setPasswordHash(userId, hash);
}
```

#### `changePassword(userId, currentPassword, newPassword, currentJti?)`

Змінити існуючий пароль + ревокувати всі інші сесії:

```typescript
async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentJti?: string,
): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.passwordHash) {
        throw new BadRequestException('No password set');
    }
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
        throw new UnauthorizedException('Invalid current password');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await this.usersService.setPasswordHash(userId, hash);

    // Інвалідація всіх інших сесій
    await this.revokeAllUserTokens(userId);

    // Видати нову пару токенів для поточної сесії
    const tokens = await this.generateTokens(userId, user.email);
    return tokens;
}
```

> **Безпека:** Після зміни пароля backend ревокує ВСІ refresh tokens (`revokeAllUserTokens()`) і видає нову пару токенів для поточного пристрою. Юзер на інших пристроях "вилітає" при наступному refresh. Це запобігає ситуації, коли зловмисник, який вже авторизований, залишається в системі після зміни пароля.

#### `deletePassword(userId)`

Видалити пароль з акаунту:

```typescript
async deletePassword(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.passwordHash) {
        throw new BadRequestException('No password to delete');
    }
    await this.usersService.clearPasswordHash(userId);
}
```

#### `verifyPassword(userId, password)`

Перевірити пароль (для account deletion confirmation):

```typescript
async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
}
```

---

## 4.3 Auth Controller — password endpoints

### `apps/api/src/modules/auth/auth.controller.ts`

Всі endpoints під `@UseGuards(JwtAuthGuard)` + `@CurrentUser()`:

#### `POST /auth/password/set`

```typescript
@Post('password/set')
@UseGuards(JwtAuthGuard)
async setPassword(@CurrentUser() user: UserDocument, @Body() dto: SetPasswordDto) {
    await this.authService.setPassword(user._id.toString(), dto.password);
    return { data: { message: 'Password set' } };
}
```

#### `POST /auth/password/change`

```typescript
@Post('password/change')
@UseGuards(JwtAuthGuard)
async changePassword(
    @CurrentUser() user: UserDocument,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
) {
    const { accessToken, refreshToken } = await this.authService.changePassword(
        user._id.toString(),
        dto.currentPassword,
        dto.newPassword,
    );

    // Оновити refresh cookie з новим токеном
    res.cookie('bid_refresh', refreshToken, {
        httpOnly: true,
        secure: ENV.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { data: { message: 'Password changed', accessToken } };
}
```

> **Примітка:** Response повертає новий `accessToken`, бо всі попередні були ревоковані. Frontend має оновити in-memory token.

#### `POST /auth/password/delete`

```typescript
@Post('password/delete')
@UseGuards(JwtAuthGuard)
async deletePassword(@CurrentUser() user: UserDocument) {
    await this.authService.deletePassword(user._id.toString());
    return { data: { message: 'Password deleted' } };
}
```

#### `POST /auth/password/verify`

```typescript
@Post('password/verify')
@UseGuards(JwtAuthGuard)
async verifyPassword(@CurrentUser() user: UserDocument, @Body() dto: VerifyPasswordDto) {
    const isValid = await this.authService.verifyPassword(user._id.toString(), dto.password);
    return { data: { isValid } };
}
```

---

## 4.4 Forgot Password integration

Forgot password — це НЕ окремий endpoint. Це magic link з purpose `reset-password`:

1. На signin page user вводить email → Scenario A (hasPassword)
2. User бачить password field (з show/hide toggle) + "Forgot password?" link + "Змінити email" link
3. Клік на "Forgot password?" → frontend викликає `sendMagicLink(email, 'reset-password')`
4. **Toast: "Якщо акаунт з цією адресою існує, ми надіслали посилання для зміни пароля"** — однаковий response незалежно від існування email (запобігає user enumeration)
5. User отримує email з reset link
6. Клік на link → verify page → purpose = 'reset-password'
7. Frontend redirect на `/profile?mode=reset-password`
8. Profile page показує password field (з show/hide toggle) як **обов'язковий** (інші поля view-only)
9. **Після зміни пароля:** Усі інші сесії ревокуються, видається нова пара токенів (див. `changePassword`)

> **Безпека:** Backend для forgot password завжди повертає однаковий успішний response (`{ message: 'Magic link sent' }`), навіть якщо email не існує в базі. Це запобігає user enumeration через forgot password flow.

---

## 4.5 Тести

### auth.service.spec.ts

**setPassword:**
- Happy path: user без password → set → success
- User already has password → BadRequestException
- User not found → NotFoundException

**changePassword:**
- Happy path: valid current + new → success + нові токени
- Invalid current password → UnauthorizedException
- No password set → BadRequestException
- Після зміни: revokeAllUserTokens() викликано
- Після зміни: повертає нові accessToken + refreshToken

**deletePassword:**
- Happy path: user з password → delete → success
- No password to delete → BadRequestException

**verifyPassword:**
- Valid password → true
- Invalid password → false
- No password set → false
- User not found → false

---

## Verification

1. `pnpm --filter api test` — всі тести pass
2. Manual: POST /auth/password/set (JWT required)
3. Manual: POST /auth/password/change (verify current)
4. Manual: POST /auth/password/delete
5. Manual: POST /auth/password/verify
