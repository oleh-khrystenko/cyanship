# Фаза 1: Foundation — packages/types + User Schema + ENV + bcrypt

> Залежності для всіх наступних фаз. Виконується першою.

## 1.1 packages/types — нові схеми та типи

### `packages/types/src/validation/common.ts`

Додати `passwordSchema`:

```typescript
export const passwordSchema = z.string().min(8);
```

### `packages/types/src/enums/error-code.ts`

Додати новий error code:

```typescript
export const ERROR_CODE = {
    // ... existing
    ACCOUNT_DELETED: 'ACCOUNT_DELETED',
    // ... existing
} as const;
```

### `packages/types/src/entities/user.ts`

Додати до `UserSchema`:

```typescript
export const UserSchema = z.object({
    // ... existing fields
    hasPassword: z.boolean(),
    deletedAt: z.coerce.date().nullable().optional(),
    // ... existing fields
});
```

Додати до `UserProfileSchema` (pick):

```typescript
export const UserProfileSchema = UserSchema.pick({
    // ... existing picks
    hasPassword: true,
    deletedAt: true,
});
```

### `packages/types/src/contracts/auth.ts`

Додати magic link purpose:

```typescript
export const MAGIC_LINK_PURPOSE = {
    LOGIN: 'login',
    REGISTER: 'register',
    RESET_PASSWORD: 'reset-password',
    DELETE_ACCOUNT: 'delete-account',
} as const;

export type MagicLinkPurpose =
    (typeof MAGIC_LINK_PURPOSE)[keyof typeof MAGIC_LINK_PURPOSE];

export const MagicLinkPurposeSchema = z.enum([
    MAGIC_LINK_PURPOSE.LOGIN,
    MAGIC_LINK_PURPOSE.REGISTER,
    MAGIC_LINK_PURPOSE.RESET_PASSWORD,
    MAGIC_LINK_PURPOSE.DELETE_ACCOUNT,
]);
```

Додати нові схеми:

```typescript
export const CheckEmailSchema = z.object({
    email: emailSchema,
});

export const CheckEmailResponseSchema = z.object({
    hasPassword: z.boolean(),
    isNewUser: z.boolean(),
});

export const LoginPasswordSchema = z.object({
    email: emailSchema,
    password: z.string(),
});

export const SetPasswordSchema = z.object({
    password: passwordSchema,
});

export const ChangePasswordSchema = z.object({
    currentPassword: z.string(),
    newPassword: passwordSchema,
});

export const VerifyPasswordSchema = z.object({
    password: z.string(),
});
```

Оновити `SendMagicLinkSchema` — додати optional purpose:

```typescript
export const SendMagicLinkSchema = z.object({
    email: z.string().email(),
    purpose: MagicLinkPurposeSchema.optional(),
});
```

Оновити `AuthResponseSchema` — додати optional purpose:

```typescript
export const AuthResponseSchema = z.object({
    user: UserProfileSchema,
    accessToken: z.string(),
    purpose: MagicLinkPurposeSchema.optional(),
});
```

Експортувати всі нові types.

### `packages/types/src/index.ts`

Перевірити що всі нові exports підхоплені через re-export `'./contracts'`, `'./validation'`, `'./entities'`, `'./enums'`.

---

## 1.2 apps/api — User Schema зміни

### `apps/api/src/modules/users/schemas/user.schema.ts`

Додати два поля до класу `User`:

```typescript
@Prop({ type: String, default: null })
passwordHash!: string | null;

@Prop({ type: Date, default: null })
deletedAt!: Date | null;
```

**Важливо:** `type: String` та `type: Date` обов'язкові — Mongoose/NestJS не може вивести тип для union `string | null`.

---

## 1.3 apps/api — ENV розширення

### `apps/api/src/config/env.ts`

Додати optional env vars з defaults (після WEB_URL):

```typescript
// Auth configuration
AUTH_PASSWORD_MIN_LENGTH: parseInt(getEnvVar('AUTH_PASSWORD_MIN_LENGTH', '8'), 10),
AUTH_LOCKOUT_THRESHOLDS: getEnvVar('AUTH_LOCKOUT_THRESHOLDS', '5:1,10:5,20:15'),
AUTH_LOGIN_ATTEMPTS_TTL_MIN: parseInt(getEnvVar('AUTH_LOGIN_ATTEMPTS_TTL_MIN', '15'), 10),
AUTH_MAGIC_LINK_DEDUP_SEC: parseInt(getEnvVar('AUTH_MAGIC_LINK_DEDUP_SEC', '60'), 10),
ACCOUNT_DELETION_GRACE_DAYS: parseInt(getEnvVar('ACCOUNT_DELETION_GRACE_DAYS', '30'), 10),
```

Додати утиліту для парсингу thresholds:

```typescript
// Парсинг AUTH_LOCKOUT_THRESHOLDS="5:1,10:5,20:15" → [{ attempts: 5, blockMin: 1 }, ...]
export function parseLockoutThresholds(raw: string): Array<{ attempts: number; blockMin: number }> {
    return raw.split(',').map((entry) => {
        const [attempts, blockMin] = entry.split(':').map(Number);
        return { attempts, blockMin };
    });
}
```

---

## 1.4 apps/api — bcrypt залежність

```bash
pnpm --filter api add bcrypt
pnpm --filter api add -D @types/bcrypt
```

Додати `bcrypt` до `onlyBuiltDependencies` в `pnpm-workspace.yaml` (потребує native compilation).

---

## 1.5 Оновити GET /users/me

### `apps/api/src/modules/users/users.controller.ts`

Додати до response:

```typescript
return {
    data: {
        // ... existing fields
        hasPassword: !!user.passwordHash,
        deletedAt: user.deletedAt ?? null,
    },
};
```

---

## Verification

1. `pnpm --filter @lucidship/types build` — компіляція без помилок
2. `pnpm --filter api test` — всі існуючі тести проходять
3. `pnpm build` — повний build без помилок
