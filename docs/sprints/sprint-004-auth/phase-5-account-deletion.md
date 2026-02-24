# Фаза 5: Account Deletion + Recovery

> Залежить від: Фаза 4

## 5.1 Users Service — account methods

### `apps/api/src/modules/users/users.service.ts`

```typescript
async softDelete(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { deletedAt: new Date() });
}

async restore(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { deletedAt: null });
}

async updateProfile(
    userId: string,
    data: { name?: string; avatar?: string; preferredLang?: string },
): Promise<UserDocument | null> {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update['profile.name'] = data.name;
    if (data.avatar !== undefined) update['profile.avatar'] = data.avatar;
    if (data.preferredLang !== undefined) update.preferredLang = data.preferredLang;
    return this.userModel.findByIdAndUpdate(userId, update, { new: true });
}
```

---

## 5.2 Users Controller — account endpoints

### `apps/api/src/modules/users/users.controller.ts`

#### `POST /users/account/delete`

Ініціація видалення. Визначає спосіб підтвердження:

```typescript
@Post('account/delete')
@UseGuards(JwtAuthGuard)
async deleteAccount(@CurrentUser() user: UserDocument) {
    if (user.passwordHash) {
        // Потрібно підтвердження паролем — frontend покаже modal
        return { data: { requiresPassword: true } };
    }
    // Без пароля — надсилаємо magic link для підтвердження
    await this.authService.sendMagicLink(
        user.email,
        MAGIC_LINK_PURPOSE.DELETE_ACCOUNT,
    );
    return { data: { requiresMagicLink: true, message: 'Confirmation link sent' } };
}
```

#### `POST /users/account/delete/confirm`

Підтвердження через пароль:

```typescript
@Post('account/delete/confirm')
@UseGuards(JwtAuthGuard)
async confirmDeleteAccount(
    @CurrentUser() user: UserDocument,
    @Body() dto: VerifyPasswordDto,
    @Res({ passthrough: true }) res: Response,
) {
    const isValid = await this.authService.verifyPassword(
        user._id.toString(),
        dto.password,
    );
    if (!isValid) {
        throw new UnauthorizedException('Invalid password');
    }

    // Soft delete
    await this.usersService.softDelete(user._id.toString());

    // Revoke all tokens
    await this.authService.revokeAllUserTokens(user._id.toString());

    // Send confirmation email
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + ENV.ACCOUNT_DELETION_GRACE_DAYS);
    await this.emailService.sendDeletionConfirmation(
        user.email,
        deletionDate,
        user.preferredLang,
    );

    // Clear cookie
    res.clearCookie('bid_refresh', { path: '/' });

    return { data: { message: 'Account scheduled for deletion' } };
}
```

#### `POST /users/account/restore`

Відновлення під час grace period:

```typescript
@Post('account/restore')
@UseGuards(JwtAuthGuard)
async restoreAccount(@CurrentUser() user: UserDocument) {
    if (!user.deletedAt) {
        throw new BadRequestException('Account is not deleted');
    }
    await this.usersService.restore(user._id.toString());
    return { data: { message: 'Account restored' } };
}
```

#### `PATCH /users/me`

Оновлення профілю:

```typescript
@Patch('me')
@UseGuards(JwtAuthGuard)
async updateProfile(@CurrentUser() user: UserDocument, @Body() body: UpdateProfileDto) {
    const updated = await this.usersService.updateProfile(user._id.toString(), body);
    return {
        data: {
            id: updated._id,
            email: updated.email,
            profile: updated.profile,
            credits: updated.credits,
            preferredLang: updated.preferredLang,
            hasPassword: !!updated.passwordHash,
            deletedAt: updated.deletedAt ?? null,
        },
    };
}
```

**UpdateProfileDto** — new DTO з Zod schema для `{ name?, avatar?, preferredLang? }`.

---

## 5.3 Magic link purpose: delete-account

### `apps/api/src/modules/auth/auth.service.ts`

При verify magic link з purpose `delete-account`:

```typescript
private async handleDeleteAccountVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    // Soft delete
    await this.usersService.softDelete(user._id.toString());

    // Revoke all tokens
    await this.revokeAllUserTokens(user._id.toString());

    // Send confirmation email
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + ENV.ACCOUNT_DELETION_GRACE_DAYS);
    await this.emailService.sendDeletionConfirmation(
        email,
        deletionDate,
        user.preferredLang,
    );

    return { deleted: true, message: 'Account scheduled for deletion' };
}
```

---

## 5.4 Auth flow з deleted account

### Зміни в `loginWithPassword`, `verifyMagicLink`, `handleGoogleAuth`

Після знаходження user — перевірити `deletedAt`:

```typescript
if (user.deletedAt) {
    // Не блокуємо повністю — даємо можливість recovery
    // Повертаємо special response замість normal auth
    const { accessToken, refreshToken } = await this.generateTokens(
        user._id.toString(),
        user.email,
    );
    return {
        user,
        accessToken,
        refreshToken,
        accountDeleted: true,
        deletedAt: user.deletedAt,
    };
}
```

Frontend при отриманні `accountDeleted: true` показує recovery screen замість redirect до app.

---

## 5.5 Confirmation email

### `apps/api/src/modules/auth/services/email.service.ts`

Новий метод:

```typescript
async sendDeletionConfirmation(email: string, deletionDate: Date, lang: string) {
    // HTML email з:
    // - Повідомлення про деактивацію
    // - Дата остаточного видалення (deletionDate)
    // - Інструкція: "Щоб відновити акаунт, просто увійдіть протягом 30 днів"
    // - CTA button: "Увійти" → WEB_URL
    // - UA/EN залежно від lang
}
```

---

## 5.6 Hard delete (cron) — окрема задача

Hard delete після grace period виходить за scope цього спринту. Потребує:
- NestJS cron job (`@nestjs/schedule`)
- Query: `{ deletedAt: { $lte: new Date(Date.now() - GRACE_DAYS * 86400000) } }`
- Cascade: видалити user, reports, payments, Redis tokens
- Звільнити email для нової реєстрації

**Можна реалізувати пізніше як окрему задачу.**

---

## 5.7 Тести

### users.service.spec.ts

- `softDelete` — sets deletedAt
- `restore` — clears deletedAt
- `updateProfile` — updates name, avatar, preferredLang

### auth.service.spec.ts

- `handleDeleteAccountVerification` — soft delete + revoke + email
- `loginWithPassword` з deleted user → accountDeleted response
- `verifyMagicLink` з deleted user → accountDeleted response

### auth.controller integration

- `POST /users/account/delete` — з password / без password
- `POST /users/account/delete/confirm` — valid/invalid password
- `POST /users/account/restore` — success / not deleted

---

## Verification

1. `pnpm --filter api test` — всі тести pass
2. Manual: повний deletion flow (з password)
3. Manual: повний deletion flow (з magic link)
4. Manual: recovery flow (login після soft delete)
5. Manual: PATCH /users/me — update profile
