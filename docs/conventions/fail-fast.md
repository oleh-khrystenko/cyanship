# Fail Fast & Env Sync Policy

> Кожна env var — required. Жодних дефолтів в коді. Всі значення живуть в `.env`.
> Якщо змінна відсутня — застосунок МУСИТЬ впасти на старті.

## Rules

1. **НІКОЛИ** не додавати fallback в `getEnvVar()` / `assertEnv()` — жодного другого аргументу
2. **НІКОЛИ** не використовувати `??`, `||`, default params для env vars
3. Якщо env var відсутня — app МУСИТЬ впасти з повідомленням: `Environment variable "X" is not defined`
4. Це стосується ОБОХ файлів:
   - `apps/api/src/config/env.ts`
   - `apps/web/src/shared/config/env.ts`
5. Виняток: `apps/api/src/test-setup.ts` — тестові placeholder значення через `??=`

## Що НЕ є env var

Env var — це те, що **відрізняється між середовищами** або є секретом: URL, credentials, ключі, ідентифікатори інфраструктури.

Продуктовий тюнінг (ліміти, TTL, пороги, feature-прапорці) env var **не є** — він однаковий скрізь, тому живе в коді:

| Тип значення | Де живе | Приклад |
|--------------|---------|---------|
| Спільне між API і web | `packages/types/src/constants/` | `ACCOUNT_DELETION_GRACE_DAYS`, `PAYMENTS_*_ENABLED`, `AI_CHAT_FREE_LIMIT` |
| Тільки для одного модуля | локальна `const` у файлі модуля | `MAGIC_LINK_TTL` (`auth.service.ts`), `AI_CHAT_IP_LIMIT` (`ai-rate-limit.guard.ts`) |

Причина жорстка: значення, продубльоване в `.env` API і `.env` web (або в `.env` і в коді), рано чи пізно розходиться — і сайт починає обіцяти одне, а бекенд робити інше. Одна константа такого стану не має.

## Як додати нову env var

1. Додай в відповідний `config/env.ts` через `getEnvVar('NAME')` (без fallback)
2. Додай в `.env.example` з placeholder значенням
3. Додай в `.env` з реальним значенням для локальної розробки
4. Додай в `apps/api/src/test-setup.ts` з тестовим placeholder
