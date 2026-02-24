# Фаза 3: Magic Link Purpose Context

> Залежить від: Фаза 1. Можна робити паралельно з Фазою 2.

## 3.1 Redis value зміна

### `apps/api/src/modules/auth/auth.service.ts`

**Зараз:**
```typescript
// sendMagicLink
await this.redis.set(`magic:${token}`, email, 'EX', 15 * 60);

// verifyMagicLink
const email = await this.redis.getdel(`magic:${token}`);
```

**Стане:**
```typescript
// sendMagicLink(email, purpose = 'login')
const payload = JSON.stringify({ email, purpose });
await this.redis.set(`magic:${token}`, payload, 'EX', 15 * 60);

// verifyMagicLink
const raw = await this.redis.getdel(`magic:${token}`);
const { email, purpose } = JSON.parse(raw);
```

### Зміни в `sendMagicLink`

```typescript
async sendMagicLink(email: string, purpose: MagicLinkPurpose = MAGIC_LINK_PURPOSE.LOGIN) {
    const normalizedEmail = email.trim().toLowerCase();

    // Rate limiting — залишається per-email (не per-purpose)
    // ... existing rate limit logic ...

    const token = randomBytes(32).toString('hex');
    const payload = JSON.stringify({ email: normalizedEmail, purpose });
    await this.redis.set(`magic:${token}`, payload, 'EX', 15 * 60);

    // Визначити мову для email
    const user = await this.usersService.findByEmail(normalizedEmail);
    const lang = user?.preferredLang ?? LANG.UK;

    await this.emailService.sendMagicLink(normalizedEmail, token, purpose, lang);
}
```

### Зміни в `verifyMagicLink`

```typescript
async verifyMagicLink(token: string) {
    const raw = await this.redis.getdel(`magic:${token}`);
    if (!raw) {
        throw new UnauthorizedException('Invalid or expired magic link');
    }

    const { email, purpose } = JSON.parse(raw) as {
        email: string;
        purpose: MagicLinkPurpose;
    };

    // Для delete-account — виконати soft delete замість auth
    if (purpose === MAGIC_LINK_PURPOSE.DELETE_ACCOUNT) {
        return this.handleDeleteAccountVerification(email);
    }

    const user = await this.usersService.findOrCreateByEmail(email);

    user.lastLoginAt = new Date();
    await user.save();

    const { accessToken, refreshToken } = await this.generateTokens(
        user._id.toString(),
        user.email,
    );

    return { user, accessToken, refreshToken, purpose };
}
```

---

## 3.2 Controller зміни

### `apps/api/src/modules/auth/auth.controller.ts`

#### Оновити `POST /auth/magic-link/send`

```typescript
@Post('magic-link/send')
async sendMagicLink(@Body() dto: SendMagicLinkDto) {
    await this.authService.sendMagicLink(
        dto.email,
        dto.purpose ?? MAGIC_LINK_PURPOSE.LOGIN,
    );
    return { data: { message: 'Magic link sent' } };
}
```

#### Оновити `POST /auth/magic-link/verify`

Додати `purpose` до response:

```typescript
return {
    data: {
        user: { /* ... */ },
        accessToken,
        purpose,  // <-- нове поле
    },
};
```

---

## 3.3 Email templates по purpose

### `apps/api/src/modules/auth/services/email.service.ts`

Рефакторити `sendMagicLink(email, token, purpose, lang)`:

```typescript
async sendMagicLink(
    email: string,
    token: string,
    purpose: MagicLinkPurpose,
    lang: string = LANG.UK,
) {
    const link = `${ENV.WEB_URL}/auth/verify?token=${token}`;
    const template = this.getEmailTemplate(purpose, lang, link);

    await this.resend.emails.send({
        from: ENV.RESEND_FROM_EMAIL,
        to: email,
        subject: template.subject,
        html: template.html,
    });
}
```

### 4 різних templates

| Purpose | Subject (UK) | Subject (EN) | CTA (UK) | CTA (EN) |
|---|---|---|---|---|
| `register` | Ласкаво просимо до LucidKit | Welcome to LucidKit | Завершити реєстрацію | Complete Registration |
| `login` | Вхід до LucidKit | Sign in to LucidKit | Увійти | Sign In |
| `reset-password` | Скидання пароля | Reset Your Password | Скинути пароль | Reset Password |
| `delete-account` | Підтвердження видалення акаунту | Confirm Account Deletion | Підтвердити видалення | Confirm Deletion |

Кожен template:
- HTML format з LucidKit брендингом (як існуючий)
- CTA button з link
- Пояснювальний текст
- Примітка "Посилання дійсне 15 хвилин" / "Link valid for 15 minutes"
- Для `delete-account`: попередження про 30-денний grace period

### Приватний метод `getEmailTemplate`

```typescript
private getEmailTemplate(purpose: MagicLinkPurpose, lang: string, link: string) {
    const templates = {
        register: {
            uk: { subject: 'Ласкаво просимо до LucidKit', /* html */ },
            en: { subject: 'Welcome to LucidKit', /* html */ },
        },
        login: {
            uk: { subject: 'Вхід до LucidKit', /* html */ },
            en: { subject: 'Sign in to LucidKit', /* html */ },
        },
        'reset-password': {
            uk: { subject: 'Скидання пароля', /* html */ },
            en: { subject: 'Reset Your Password', /* html */ },
        },
        'delete-account': {
            uk: { subject: 'Підтвердження видалення акаунту', /* html */ },
            en: { subject: 'Confirm Account Deletion', /* html */ },
        },
    };

    return templates[purpose][lang] ?? templates[purpose]['uk'];
}
```

---

## 3.4 Тести

### auth.service.spec.ts

**sendMagicLink з purpose:**
- Default purpose = 'login'
- Explicit purpose зберігається в Redis як JSON
- Rate limiting працює per-email (не per-purpose)
- Email service отримує правильний purpose + lang

**verifyMagicLink з purpose:**
- Purpose 'login' → повертає user + purpose
- Purpose 'register' → повертає user + purpose
- Purpose 'reset-password' → повертає user + purpose
- Purpose 'delete-account' → виконує soft delete (окремий flow)
- Invalid/expired token → 401

### email.service.spec.ts (new або extend)

- Correct template selected per purpose
- Correct language (uk/en)
- Link includes token
- Subject matches purpose

---

## Verification

1. `pnpm --filter api test` — всі тести pass
2. Manual: send magic link з різними purposes — перевірити email content
3. Manual: verify magic link — перевірити purpose в response
