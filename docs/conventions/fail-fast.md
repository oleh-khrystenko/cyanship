# Fail Fast Policy

> Застосунок МУСИТЬ впасти на старті, якщо обов'язкова змінна середовища відсутня.
> Тихі fallback-и заборонені.

## Rules

1. **НІКОЛИ** не додавати fallback для URLs, secrets, API keys, connection strings
2. **НІКОЛИ** не використовувати `??`, `||`, default params для прихованого поглинання відсутніх env vars
3. Якщо env var відсутня — app МУСИТЬ впасти з чітким повідомленням: `Environment variable "X" is not defined`
4. Це стосується ОБОХ файлів:
   - `apps/api/src/config/env.ts`
   - `apps/web/src/shared/config/env.ts`
5. Допустимі defaults лише для non-critical змінних (див. нижче)

## Допустимі defaults

### Runtime / core

| Змінна | Default | Причина |
|--------|---------|---------|
| `NODE_ENV` | `'development'` | Стандартна конвенція |
| `PORT` | `'4000'` | Зручність локальної розробки |
| `WEB_URL` | `'http://localhost:3000'` | Зручність локальної розробки |
| `RESEND_FROM_EMAIL` | `'CyanShip <onboarding@resend.dev>'` | Dev sandbox Resend (на production — required) |

### Auth tuning

| Змінна | Default | Причина |
|--------|---------|---------|
| `AUTH_PASSWORD_MIN_LENGTH` | `8` | Розумний мінімум |
| `AUTH_LOCKOUT_THRESHOLDS` | `'5:1,10:5,20:15'` | Стандартні пороги блокування |
| `AUTH_LOGIN_ATTEMPTS_TTL_MIN` | `15` | Вікно підрахунку спроб |
| `AUTH_MAGIC_LINK_TTL_MIN` | `15` | Час життя magic link |
| `AUTH_MAGIC_LINK_RATE_LIMIT` | `3` | Ліміт запитів magic link |
| `AUTH_MAGIC_LINK_RATE_WINDOW_MIN` | `15` | Вікно rate limit |
| `AUTH_MAGIC_LINK_DEDUP_SEC` | `60` | Дедуплікація повторних запитів |
| `ACCOUNT_DELETION_GRACE_DAYS` | `30` | Grace period перед hard-delete |

### Payment toggles та billing URLs

| Змінна | Default | Причина |
|--------|---------|---------|
| `PAYMENTS_SUBSCRIPTION_ENABLED` | `'true'` | Feature flag, увімкнено за замовчуванням |
| `PAYMENTS_ONE_OFF_ENABLED` | `'true'` | Feature flag, увімкнено за замовчуванням |
| `BILLING_SUCCESS_URL` | `WEB_URL + '/billing/success'` | Обчислюється з `WEB_URL` |
| `BILLING_CANCEL_URL` | `WEB_URL + '/billing/cancel'` | Обчислюється з `WEB_URL` |

## Як додати нову env var

1. Додай в відповідний `config/env.ts` через `getEnvVar('NAME')` (без fallback) або `getEnvVar('NAME', 'default')` (з fallback)
2. Додай в `.env.example` з поясненням
3. Додай в `.env` з реальним значенням для локальної розробки
4. Якщо required — переконайся, що fallback НЕ передається
