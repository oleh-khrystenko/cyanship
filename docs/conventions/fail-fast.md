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

## Одне значення — одна змінна

Якщо одне й те саме значення потрібне і бекенду, і фронту, воно **не дублюється** під двома іменами. Змінна лишається одна, а `apps/web/next.config.ts` інлайнить її у фронтовий бандл під `NEXT_PUBLIC_*` іменем через ключ `env`:

| `.env` | Інлайниться як | Хто споживає |
|--------|----------------|--------------|
| `WEB_URL` | `NEXT_PUBLIC_BASE_URL` | API (CORS, листи, Stripe return URLs) + web (canonical/OG) |
| `R2_PUBLIC_URL` | `NEXT_PUBLIC_STORAGE_URL` | API (аватари в R2) + web (`next/image` hostname, публічні ассети) |

`NEXT_PUBLIC_*` без запису в `.env` — це нормально: значення приходить із мапінгу в `next.config.ts`, а `assertEnv` у web все одно впаде на збірці, якщо мапінг зламали.

Так само не є змінною те, що архітектурно не може відрізнятись: шлях до API — константа `API_BASE_PATH = '/api'` (`apps/web/src/shared/config/api.ts`), бо `bid_refresh` cookie вимагає same-origin проксі. Наслідок: `API_INTERNAL_URL` (ціль цього проксі) — required, а не optional. Без нього браузер не має жодного шляху до бекенду, тому `next.config.ts` валить збірку, а не будує мовчки мертвий фронт.

`WEB_URL`, `R2_PUBLIC_URL` і `API_INTERNAL_URL` проходять `requireOrigin` у `next.config.ts`: HTTP(S) origin без path і без trailing slash. Причина — всі три склеюються з хвостами (`${WEB_URL}/${locale}`, `${R2_PUBLIC_URL}/${key}`), і зайвий слеш дає `//` у canonical, листах і Stripe return URLs.

## Як додати нову env var

1. Перевір, чи це справді env var (розділи вище) і чи такого значення ще немає під іншим іменем
2. Додай в відповідний `config/env.ts` через `getEnvVar('NAME')` (без fallback)
3. Додай в `.env.example` з placeholder значенням
4. Додай в `.env` з реальним значенням для локальної розробки
5. Додай в `apps/api/src/test-setup.ts` з тестовим placeholder
6. Якщо значення потрібне у Docker-збірці web — додай `ARG`/`ENV` у `apps/web/Dockerfile` і build-арг у `compose.yaml`
