# Аудит імплементації авторизації (Lucid Ship)

Дата аудиту: 23 лютого 2026
Останнє оновлення: 23 лютого 2026
Гілка: `feature/auth`
Проєкт: `lucid-ship`
Контекст: імплементація авторизації була перенесена з BidGuard у Lucid Ship.

## 1. Мета і scope

Цей аудит покриває:

- backend auth-флоу (`Google OAuth`, `Magic Link`, `JWT access/refresh`, rotation/revocation);
- frontend auth-флоу (`middleware`, `AuthInitializer`, `AuthGuard`, callback/verify/signin pages);
- безпекові ризики після міграції;
- узгодженість API/FE контрактів (`@lucidship/types`);
- CI/runtime працездатність через `lint`, `test`, `build`, `test:e2e`.

Цей документ **не вносить кодові правки**; це технічний звіт із конкретним планом виправлень.

## 2. Що було перевірено

### 2.1 Ключові файли

- `apps/api/src/modules/auth/*`
- `apps/api/src/modules/users/*`
- `apps/api/src/common/guards/jwt-auth.guard.ts`
- `apps/api/src/common/decorators/current-user.decorator.ts`
- `apps/api/src/common/providers/redis.provider.ts`
- `apps/api/src/config/env.ts`
- `apps/api/test/app.e2e-spec.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/features/auth/*`
- `apps/web/src/shared/api/*`
- `apps/web/src/app/[locale]/auth/*`
- `packages/types/src/contracts/auth.ts`
- `packages/types/src/entities/user.ts`
- `.env.example`, `README.md`, `docker-compose*.yml`

### 2.2 Команди і результати

1. `pnpm lint`
Результат: пройшло, warnings без blocking errors.

2. `pnpm --filter api test`
Результат: пройшло (`38/38`).

3. `pnpm --filter api build`
Результат: пройшло.

4. `pnpm build`
Результат: впало на web build через fetch Google Fonts (`Mulish`) у sandbox/network-restricted середовищі.

5. `pnpm --filter api test:e2e`
Результат: провалено. E2E піднімає реальний `AppModule`, тягне реальні Mongo/Redis підключення, зависає/timeout, не закриває open handles.

## 3. Підсумок по ризиках

- Critical: 1
- High: 3
- Medium: 4
- Low: 3

Найважливіше: спочатку виправити ізоляцію середовищ (BidGuard vs Lucid Ship), одноразовість magic-link, OAuth hardening, та e2e-стенд.

## 4. Детальні findings

## F-01 (Critical) — production-ресурси BidGuard у локальному `.env`

### Де знайдено

- `.env:6`
- `.env:7`
- `.env:20`

### Симптом

У локальному env присутні значення, що явно вказують на BidGuard (MongoDB DB/cluster, bucket naming).

### Ризик

- перехресне змішання даних між двома проєктами;
- випадкові записи/видалення у чужому прод-середовищі;
- неконтрольовані витоки секретів;
- хибний результат тестів (ти тестуєш не Lucid Ship інфраструктуру).

### Як відтворюється

`pnpm --filter api test:e2e` запускає `AppModule`, після чого видно спроби конекту до `bidguard-prod...`.

### Що виправити

1. Розвести секрети по окремих env-файлах для двох проєктів.
2. Перегенерувати/ротувати ключі, які вже потрапили в репозиторій/локальні шари CI.
3. Перевірити, що `.env` не трекається git (у цьому репо `.env` ігнорується).
4. Для локальних тестів використовувати тестовий `.env.test` з локальними/контейнерними сервісами.

### Критерій готовності

- E2E не звертається до BidGuard інфраструктури.
- Всі інтеграційні auth-тести працюють на ізольованих ресурсах Lucid Ship.

## F-02 (High) — magic-link не strictly одноразовий (race condition)

### Де знайдено

- `apps/api/src/modules/auth/auth.service.ts:172`
- `apps/api/src/modules/auth/auth.service.ts:180`

### Симптом

Схема `GET magicKey` -> `DEL magicKey` не атомарна.

### Ризик

Два конкурентні запити можуть одночасно валідувати один і той самий токен до моменту видалення.

### Що виправити

Зробити атомарне споживання токена:

1. Redis `GETDEL` (якщо версія/клієнт підтримує).
2. Або Lua script (`GET` + `DEL` в одному atomic eval).
3. Додати тест на паралельну верифікацію одного токена.

### Критерій готовності

- Один magic token може успішно пройти верифікацію тільки один раз.

## F-03 (High) — Google OAuth hardening неповний (`state`, email validation)

### Де знайдено

- `apps/api/src/modules/auth/strategies/google.strategy.ts:17`
- `apps/api/src/modules/auth/strategies/google.strategy.ts:37`

### Симптом

- У конфігурації strategy не видно явного `state: true`.
- Email може бути порожнім (`''` fallback), якщо Google не повернув `emails`.

### Ризик

- login CSRF/flow injection ризики без state-перевірки;
- порожній email → `findOrCreateByGoogle` → Mongoose `create({ email: '' })` → validation error на `required: true` → необроблена 500 помилка;
- неконсистентний user-creation flow.

### Що виправити

1. Увімкнути `state` в OAuth flow.
2. Валідовувати email і переривати flow з контрольованою помилкою, якщо email відсутній.
3. За можливості перевіряти `email_verified`.
4. Додати e2e/unit сценарій для "Google profile без email".

### Критерій готовності

- OAuth callback без валідного email завершується очікуваною 4xx помилкою.
- State-параметр обов'язковий і валідується.

## F-04 (High) — `api test:e2e` піднімає реальні зовнішні залежності

### Де знайдено

- `apps/api/test/app.e2e-spec.ts:12`
- `apps/api/src/app.module.ts:23`
- `apps/api/src/modules/auth/auth.module.ts:48`

### Симптом

E2E імпортує повний `AppModule`, що одразу ініціалізує Mongoose/Redis провайдери. Відсутній `afterEach`/`afterAll` з `await app.close()` — open handles не закриваються.

### Ризик

- flaky e2e;
- таймаути і зависання;
- відкриті хендли після тестів;
- тести неможливо стабільно запускати в CI без доступу до зовнішньої мережі.

### Що виправити

1. Створити test module для e2e з mock/in-memory залежностями.
2. Або піднімати dockerized Mongo/Redis в test pipeline із гарантованим lifecycle.
3. Додати `afterEach/afterAll` з `await app.close()`.
4. Розглянути окрему конфігурацію `AppModule.forTest()` або conditional providers.

### Критерій готовності

- `pnpm --filter api test:e2e` стабільно проходить локально і в CI без зовнішніх прод-конектів.

## F-05 (Medium) — rate-limit magic-link можна обходити варіантами email

### Де знайдено

- `apps/api/src/modules/auth/auth.service.ts:149`
- `apps/api/src/modules/auth/auth.service.ts:161`
- `packages/types/src/contracts/auth.ts:6`

### Симптом

Rate-limit key формується з raw email без нормалізації (`trim().toLowerCase()`). Zod `.email()` валідує формат, але не нормалізує. Плюс логіка `GET` (рядок 150) + `INCR` (рядок 161) — TOCTOU race: при 3 конкурентних запитах з `count=2` всі 3 прочитають `"2"`, жоден не кинe 429, всі 3 пройдуть далі і відправлять листи.

### Ризик

- Обхід ліміту через `User@Mail.com`, `user@mail.com`, ` user@mail.com `.
- Конкурентні запити обходять ліміт через TOCTOU race.

### Що виправити

1. Нормалізувати email на вході: `email.trim().toLowerCase()` перед формуванням rate-limit key та збереженням magic token.
2. Ліміт будувати атомарно: `INCR` first → перевірити результат → `EXPIRE` if first hit (або Lua script).
3. Додати unit tests на кейси casing/whitespace/concurrency.

### Критерій готовності

- Ліміт не обходиться форматними варіантами одного email.
- Конкурентні запити не обходять ліміт.

## F-06 (Medium) — cookie стратегія може ламатися у split-domain деплої

### Де знайдено

- `apps/api/src/modules/auth/auth.controller.ts:21`
- `apps/web/src/middleware.ts:21`

### Симптом

Frontend middleware авторизації покладається на `bid_refresh` cookie на web-домені. При API/Web на різних доменах host-only cookie може не передаватися туди, де middleware очікує її бачити.

### Ризик

- фальшиві редіректи на signin;
- "нескінченні" auth-кола;
- неочікувана поведінка при прод-інфраструктурі з окремими доменами.

### Що виправити

1. Визначити цільову модель деплою:
   - один домен через reverse proxy; або
   - чітко налаштовані subdomains + cookie `Domain` + `SameSite=None` + `Secure`.
2. Синхронізувати CORS/cookie/redirect конфіг.
3. Додати інфраструктурний тест авторизації в продоподібному setup.

### Критерій готовності

- Middleware і refresh flow стабільно працюють у вашій реальній доменній схемі.

## F-07 (Medium) — grace period amplification: необмежена генерація токенів

### Де знайдено

- `apps/api/src/modules/auth/auth.service.ts:92-95`

### Симптом

Коли `rotateRefreshToken` отримує jti зі значенням `'rotated'` (grace period), метод одразу викликає `generateTokens()` без будь-яких обмежень чи видалення rotated запису. Кожен виклик додає новий jti до `refresh_family` set.

### Ризик

- Протягом 10-секундного grace period зловмисник з перехопленим rotated token може згенерувати необмежену кількість token pairs.
- `refresh_family` set розростається — кожен запит додає новий jti.
- Amplification attack: 1 перехоплений cookie → N сесій.

### Що виправити

1. Після першого використання rotated token — видаляти його з Redis (`DEL refresh:{jti}`) перед генерацією нових токенів. Це обмежує grace period до одного додаткового використання.
2. Або: використовувати атомарний `GETDEL` для rotated value — тільки перший concurrent запит отримає `'rotated'`, решта отримає `null` → reuse detection.
3. Додати тест на множинні запити з rotated token.

### Критерій готовності

- Один rotated token може бути використаний максимум один раз протягом grace period.

## F-08 (Medium) — email leak у повідомленні rate-limit помилки

### Де знайдено

- `apps/api/src/modules/auth/auth.service.ts:211-215`

### Симптом

`TooManyRequestsException` включає email у повідомлення помилки:
```
Too many magic link requests for user@example.com. Try again in 15 minutes.
```

Через `AllExceptionsFilter` це повідомлення потрапляє у HTTP response body.

### Ризик

- Information disclosure: атакуючий може підтвердити існування email через rate limit response.
- Порушення принципу "не розкривати деталі у error messages".

### Що виправити

1. Прибрати email з повідомлення помилки. Використати generic text:
   `Too many requests. Try again in 15 minutes.`

### Критерій готовності

- Rate-limit error response не містить email чи інших PII.

## F-09 (Low) — дубльований refresh на callback route

### Де знайдено

- `apps/web/src/features/auth/AuthInitializer.tsx:19`
- `apps/web/src/app/[locale]/auth/callback/page.tsx:18`

### Симптом

`AuthInitializer` глобально викликає `refreshToken()`, і callback page теж викликає `refreshToken()`.

### Ризик

- зайві запити/ротації;
- додаткове навантаження;
- потенційні race-ефекти на повільній мережі.

### Що виправити

1. Винести auth bootstrap у route-aware логіку.
2. На `auth/callback` (і за потреби `auth/verify`) вимикати глобальний initializer.

### Критерій готовності

- На callback виконується один контрольований refresh flow.

## F-10 (Low) — web build залежить від зовнішнього доступу до Google Fonts

### Де знайдено

- `apps/web/src/app/[locale]/layout.tsx:5`

### Симптом

`pnpm build` впав з `Failed to fetch Mulish from Google Fonts` у мережево-обмеженому середовищі.

### Ризик

- нестабільний CI build;
- неможливість офлайн/ізольованої збірки.

### Що виправити

1. Локальне хостинг шрифту (self-hosted).
2. Або fallback стратегія для environments без outbound доступу.

### Критерій готовності

- `pnpm build` стабільно проходить у CI з обмеженим інтернетом.

## F-11 (Low) — warnings у lint (не блокують, але зашумлюють якість)

### Де знайдено

- `apps/web/src/shared/ui/UiButton/UiButton.tsx:141`
- `apps/api/src/modules/auth/auth.service.spec.ts:384`

### Симптом

Unused vars у UI button та unsafe argument warnings у spec.

### Ризик

- шум у CI;
- складніше відловлювати реальні проблеми.

### Що виправити

1. Рефакторити деструктуризацію в `UiButton`.
2. У тестах прибрати `any`-передачі або звузити типи.

### Критерій готовності

- Lint без попереджень у змінених модулях auth/UI.

## 5. Технічний борг після переносу з BidGuard

Після масового копіювання виявлено, що ключова логіка auth переїхала, але частина операційних шарів лишилася в режимі "працює локально за збігом обставин":

- env-ізоляція між двома проєктами відсутня;
- e2e стенд не ізольований;
- безпекові edge-cases не закриті повністю;
- частина поведінки залежить від інфраструктурних припущень (домен/cookie мережа).

## 6. Пріоритетний план виправлення

## P0 (негайно)

1. Розвести `.env`/секрети Lucid Ship і BidGuard, зробити ротацію ключів.
2. Виправити одноразовість magic-link (atomic consume — `GETDEL` або Lua).
3. Додати OAuth hardening (`state`, обов'язковий email, перевірка `email_verified`).

## P1 (найближчий спринт)

1. Переробити e2e-середовище (mock/in-memory або test-containers).
2. Закрити rate-limit normalization + atomicity (INCR-first pattern).
3. Узгодити cookie/domain стратегію з реальним деплоєм.
4. Обмежити grace period amplification (atomic consume rotated token).
5. Прибрати email з rate-limit error message.

## P2 (після стабілізації)

1. Прибрати дубль refresh flow.
2. Забезпечити офлайн/CI стійкість шрифтів.
3. Почистити lint warnings.

## 7. Definition of Done для auth-модуля після виправлень

- `pnpm lint` без нових warnings у auth-змінених файлах.
- `pnpm --filter api test` green.
- `pnpm --filter api test:e2e` green у ізольованому тестовому середовищі.
- `pnpm build` green без зовнішньої залежності від fonts API.
- Жоден auth-тест не використовує BidGuard ресурси.
- Magic-link строго одноразовий навіть під concurrency.
- Rotated refresh token використовується максимум один раз у grace period.
- OAuth callback без email повертає контрольовану 4xx помилку.
- Error messages не містять PII (email, userId).
- Документація env/deploy оновлена під фактичну cookie/domain модель.

## 8. Висновок

Імплементація авторизації загалом перенесена і базово працює (unit test + lint + api build проходять), але в поточному стані має критичний операційний ризик (перетин із BidGuard), кілька high-рівневих security/reliability прогалин і нестабільність e2e/CI сценаріїв.

Рекомендовано не вважати migration завершеною, поки не закрито `P0` та `P1`.
