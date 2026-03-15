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

| Змінна | Default | Причина |
|--------|---------|---------|
| `NODE_ENV` | `'development'` | Стандартна конвенція |
| `PORT` | `'4000'` | Зручність локальної розробки |
| `WEB_URL` | `'http://localhost:3000'` | Зручність локальної розробки |
| `RESEND_FROM_EMAIL` | `'CyanShip <onboarding@resend.dev>'` | Dev sandbox Resend |

## Як додати нову env var

1. Додай в відповідний `config/env.ts` через `getEnvVar('NAME')` (без fallback) або `getEnvVar('NAME', 'default')` (з fallback)
2. Додай в `.env.example` з поясненням
3. Якщо required — переконайся, що fallback НЕ передається
