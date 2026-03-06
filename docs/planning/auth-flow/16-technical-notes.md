# Технічні нотатки

## Backend endpoint: перевірка email

```
POST /api/auth/check-email
Body: { email: string }
Response: { hasPassword: boolean, isNewUser: boolean }
```

> **Безпека:** Цей endpoint розкриває чи існує email в базі. Це прийнятний trade-off для UX (такий самий підхід у Slack, Notion, GitHub). Rate limit per-IP обов'язковий (10 req/min). Для forgot password використовується окрема стратегія — однакова відповідь незалежно від існування email.

## Magic link context

Magic link має нести контекст (для якого сценарію він створений), щоб профіль знав який UI показувати:

- `purpose: 'login'` — Сценарій B (існуючий без пароля)
- `purpose: 'register'` — Сценарій C (новий юзер)
- `purpose: 'reset-password'` — Forgot password

Контекст зберігається в Redis разом з token.

## Зміни в User schema

```
passwordHash: string | null  // bcrypt hash, null = немає пароля
```

## Зміни в Redis keys

```
login_attempts:{ip}:{email} → count (TTL = AUTH_LOGIN_ATTEMPTS_TTL_MIN)
check_email:{ip} → count (TTL = 60s)
magic_dedup:{email}:{purpose} → token (TTL = AUTH_MAGIC_LINK_DEDUP_SEC)
```
