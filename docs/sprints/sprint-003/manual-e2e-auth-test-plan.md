# Sprint 003: E2E Testing (ручне, вирівняно з поточним кодом)

Дата актуалізації: 2026-02-23

## Що скориговано відносно початкового плану

- Маршрути в застосунку локалізовані (`/{locale}/...`), unprefixed URL можуть давати додатковий redirect через `next-intl` middleware.
- API має глобальний префікс `/api`, тому в Network очікувані запити виду `/api/auth/...`, `/api/users/me`.
- На сторінці `/check` зараз **немає** кнопки `Test Token Refresh`; для token-lifecycle сценаріїв потрібні DevTools (Network/Console).
- UI-повідомлення для rate limit на signin зараз загальне (`Щось пішло не так...`), без окремого тексту “зачекайте”.
- В email шаблоні бренд і CTA: `LucidKit`, `Увійти в LucidKit`.

---

## Підготовка

- DevTools відкриті (вкладки: `Network`, `Application -> Cookies`, `Console`)
- У `Network` увімкнути `Preserve log`
- Взяти базовий locale для тестів: `uk` (default) або `en`
- Для тестів токенів тимчасово змінити TTL:
  - `apps/api/src/modules/auth/auth.service.ts`
    - access token: `'1m'` (замість `'1h'`)
    - refresh token: `'2m'` (замість `'7d'`)
  - (опційно для консистентності) `apps/api/src/modules/auth/auth.module.ts` `signOptions.expiresIn: '1m'`
- Після зміни TTL перезапустити API
- Після завершення тестів повернути дефолт: `'1h'` і `'7d'`

---

## A. Auth Flows

### Тест 1: Google OAuth — повний flow

**Мета:** Перевірити шлях авторизації через Google

**Precondition:** Не авторизований (немає cookie `bid_refresh`)

**Steps:**

1. Перейти на `/{locale}/auth/signin` (наприклад `/uk/auth/signin`)
2. Натиснути кнопку `Продовжити з Google`
3. Пройти Google consent screen
4. Дочекатись redirect назад

**Expected:**

- [ ] Browser переходить на `accounts.google.com`
- [ ] Після consent є redirect на `/auth/callback` (далі локалізована сторінка callback)
- [ ] Network: `POST /api/auth/refresh` -> `200`, отримано `accessToken`
- [ ] Network: `GET /api/users/me` -> `200`, отримано профіль
- [ ] Redirect на `/{locale}/check`
- [ ] `Application -> Cookies`: `bid_refresh` присутній (`httpOnly`, `path=/`)
- [ ] Header показує email/avatar та кредити
- [ ] URL: `/{locale}/check`, не `/{locale}/auth/signin`

---

### Тест 2: Magic Link — повний flow (новий користувач)

**Мета:** Перевірити вхід через email для нового користувача

**Precondition:** Не авторизований, email ще не реєструвався

**Steps:**

1. Перейти на `/{locale}/auth/signin`
2. Ввести email
3. Натиснути `Надіслати Magic Link`
4. Відкрити email і клікнути `Увійти в LucidKit`

**Expected:**

- [ ] Після submit UI переходить у `sent` state (`Перевірте пошту`)
- [ ] Email отримано
- [ ] Клік по лінку відкриває `/auth/verify` (далі локалізована verify сторінка)
- [ ] Network: `POST /api/auth/magic-link/verify` -> `200`, payload `{ user, accessToken }`
- [ ] `Application -> Cookies`: `bid_refresh` встановлено
- [ ] Redirect на `/{locale}/check`
- [ ] Header показує дані користувача
- [ ] MongoDB: створено новий `User` документ з цим email

---

### Тест 3: Magic Link — повний flow (існуючий користувач)

**Мета:** Переконатись, що повторний вхід не дублює User

**Precondition:** Не авторизований, email з Тесту 2

**Steps:**

1. Пройти Magic Link flow тим самим email

**Expected:**

- [ ] Вхід успішний, профіль той самий
- [ ] MongoDB: документ користувача один (без дублю)
- [ ] `credits.balance` та `freeReportUsed` збережені

---

### Тест 4: Magic Link — невалідний token

**Мета:** Перевірити обробку підробленого або вже використаного token

**Precondition:** Не авторизований

**Steps:**

1. Відкрити: `/{locale}/auth/verify?token=fakeinvalidtoken123`

**Expected:**

- [ ] Verify сторінка показує помилку (`Посилання недійсне або прострочене`)
- [ ] Network: `POST /api/auth/magic-link/verify` -> `401`
- [ ] Кнопка `Спробувати знову` веде на `/{locale}/auth/signin`
- [ ] `bid_refresh` cookie не встановлено

---

### Тест 5: Magic Link — прострочений token (>15 хв)

**Мета:** Переконатись, що token TTL 15 хв працює

**Precondition:** Надіслано Magic Link, але не відкрито

**Steps:**

1. Надіслати Magic Link
2. Почекати 16+ хвилин
3. Клікнути лінк з email

**Expected:**

- [ ] Verify сторінка показує помилку
- [ ] Network: `POST /api/auth/magic-link/verify` -> `401` (`Invalid or expired magic link token`)
- [ ] `bid_refresh` cookie не встановлено

---

### Тест 6: Magic Link — rate limit (3 за 15 хв)

**Мета:** Перевірити anti-abuse ліміт

**Precondition:** Не авторизований

**Steps:**

1. Надіслати Magic Link на один email (1-й)
2. Одразу повторити (2-й)
3. Одразу повторити (3-й)
4. Надіслати 4-й раз

**Expected:**

- [ ] 1-3 запити успішні (UI в `sent` state)
- [ ] 4-й запит: Network `POST /api/auth/magic-link/send` -> `429`
- [ ] UI показує загальну помилку (`Щось пішло не так...`) для 4-го запиту

---

## B. Token Lifecycle

### Тест 7: Access Token expiry + refresh chain (через DevTools)

**Мета:** Перевірити, що expired access token більше не валідний, а refresh видає новий

**Precondition:** access TTL = `1m`, refresh TTL = `2m`, авторизований

**Steps:**

1. Авторизуватись
2. У `Network` знайти останній `POST /api/auth/refresh`, скопіювати `accessToken` з response (`access_old`)
3. Почекати 1+ хв
4. У Console викликати `GET /api/users/me` з `Authorization: Bearer access_old`
5. Викликати `POST /api/auth/refresh` з `credentials: include`
6. Повторно викликати `GET /api/users/me` з новим access token

**Expected:**

- [ ] `GET /api/users/me` з `access_old` -> `401`
- [ ] `POST /api/auth/refresh` -> `200` і повертає новий `accessToken`
- [ ] Наступний `GET /api/users/me` з новим access -> `200`
- [ ] `bid_refresh` cookie оновлюється (rotation)

---

### Тест 8: Refresh Token expiry (примусовий logout path)

**Мета:** Переконатись, що після expiry refresh token сесія не відновлюється

**Precondition:** access TTL = `1m`, refresh TTL = `2m`, авторизований

**Steps:**

1. Авторизуватись
2. Почекати 2+ хв
3. Перезавантажити сторінку на `/{locale}/check`

**Expected:**

- [ ] Network: `POST /api/auth/refresh` -> `401`
- [ ] Відповідь містить очищення cookie (`Set-Cookie` з видаленням `bid_refresh`)
- [ ] `Application -> Cookies`: `bid_refresh` відсутній
- [ ] Стан auth очищений (`user = null`, `isAuthenticated = false`)
- [ ] Redirect на `/{locale}/auth/signin`

---

### Тест 9: Token Rotation — cookie змінюється при refresh

**Мета:** Перевірити ротацію refresh token

**Precondition:** access TTL = `1m`, авторизований

**Steps:**

1. Авторизуватись, зафіксувати значення `bid_refresh` (`cookie_old`)
2. Дочекатись refresh (наприклад через F5, який тригерить `AuthInitializer -> /auth/refresh`)
3. Зафіксувати нове значення `bid_refresh` (`cookie_new`)

**Expected:**

- [ ] `cookie_new` відрізняється від `cookie_old`
- [ ] `POST /api/auth/refresh` повернув `200`

---

### Тест 10: Token Rotation — reuse detection

**Мета:** Перевірити захист від повторного використання ротованого refresh token

**Precondition:** access TTL = `1m`, авторизований

**Steps:**

1. Авторизуватись, скопіювати `bid_refresh` (`cookie_old`)
2. Зробити refresh і дочекатись нової cookie (`cookie_new`)
3. Почекати 11+ секунд (щоб вийти за `ROTATION_GRACE_PERIOD=10s`)
4. Вручну підставити `cookie_old`
5. Викликати `POST /api/auth/refresh`

**Expected:**

- [ ] `POST /api/auth/refresh` -> `401` (`Refresh token reuse detected`)
- [ ] Cookie очищено response-ом
- [ ] Поточна сесія стає невалідною, потрібен повторний логін

---

### Тест 11: Token Rotation — grace period (concurrent tabs)

**Мета:** Перевірити tolerated refresh у двох табах в межах grace window

**Precondition:** access TTL = `1m`, авторизований

**Steps:**

1. Відкрити два таби на `/{locale}/check`
2. В обох табах мати однакову refresh cookie
3. У табі A викликати refresh
4. У табі B викликати refresh протягом 10 сек після кроку 3

**Expected:**

- [ ] Таб A: `POST /api/auth/refresh` -> `200`
- [ ] Таб B: `POST /api/auth/refresh` -> `200` (за рахунок grace period)
- [ ] Reuse detection не спрацював

**Negative branch (окремий прогін):**

5. Повторити сценарій, але в табі B викликати refresh через 11+ сек

- [ ] Таб B: `POST /api/auth/refresh` -> `401` (reuse detected)

---

## C. Route Protection

### Тест 12: Protected routes — неавторизований користувач

**Мета:** Перевірити middleware захист

**Precondition:** Немає `bid_refresh`

**Steps:**

1. Відкрити `/{locale}/check`
2. Відкрити `/{locale}/pay`

**Expected:**

- [ ] Для обох URL: redirect на `/{locale}/auth/signin`
- [ ] Сторінки protected контенту не рендеряться

---

### Тест 13: Auth route — авторизований користувач

**Мета:** Перевірити, що авторизований юзер не залишається на signin

**Precondition:** Є валідний `bid_refresh`

**Steps:**

1. Відкрити `/{locale}/auth/signin`

**Expected:**

- [ ] Redirect на `/{locale}/check`
- [ ] Signin форма не залишається на екрані

---

### Тест 14: Публічні сторінки — доступ для всіх

**Мета:** Перевірити доступність landing + signin

**Precondition:** Не авторизований

**Steps:**

1. Відкрити `/` (або `/{locale}`)
2. Відкрити `/{locale}/auth/signin`

**Expected:**

- [ ] `/` може зробити locale-redirect, далі landing доступний
- [ ] `/{locale}/auth/signin` доступний без авторизації
- [ ] Header показує кнопку `Увійти`

**Precondition:** Авторизований

- [ ] `/{locale}` доступний (landing публічний)
- [ ] Header показує профіль користувача

---

## D. Session Management

### Тест 15: Logout — повний flow

**Мета:** Перевірити очищення сесії на сервері і клієнті

**Precondition:** Авторизований, на `/{locale}/check`

**Steps:**

1. Натиснути `Вийти` в Header
2. Спробувати перейти на `/{locale}/check`

**Expected:**

- [ ] Network: `POST /api/auth/logout` -> `200`
- [ ] Response очищає `bid_refresh`
- [ ] `Application -> Cookies`: `bid_refresh` видалено
- [ ] Клієнтський auth state очищений
- [ ] Після logout redirect на `/{locale}` (landing)
- [ ] Повторний перехід на `/{locale}/check` редиректить на `/{locale}/auth/signin`

---

### Тест 16: Logout — старий token не працює

**Мета:** Переконатись, що logout ревокує refresh token

**Precondition:** Авторизований

**Steps:**

1. Скопіювати `bid_refresh` (`cookie_old`)
2. Натиснути `Вийти`
3. Залогінитись знову (нова сесія)
4. Підставити вручну `cookie_old`
5. Викликати `POST /api/auth/refresh`

**Expected:**

- [ ] `POST /api/auth/refresh` зі старим токеном -> `401`
- [ ] Redirect/стан неавторизованого

---

### Тест 17: Session persistence — перезавантаження сторінки

**Мета:** Перевірити відновлення сесії через `AuthInitializer`

**Precondition:** Авторизований, на `/{locale}/check`

**Steps:**

1. Натиснути `F5`

**Expected:**

- [ ] `AuthInitializer` виконується (refresh + me)
- [ ] Network: `POST /api/auth/refresh` -> `200`
- [ ] Network: `GET /api/users/me` -> `200`
- [ ] Header: спочатку loading skeleton, потім профіль
- [ ] Cookie `bid_refresh` ротується

---

### Тест 18: Concurrent requests — dedup refresh у frontend client

**Мета:** Перевірити dedup логіку `refreshPromise` у `apiClient`

**Статус:** `BLOCKED` для чисто ручного E2E в поточному UI.

**Причина блокування:** на `/{locale}/check` немає debug-trigger, який ініціює два паралельні protected запити через `apiClient`; відповідно dedup з `shared/api/client.ts` не спостерігається напряму.

**Що потрібно для розблокування:**

- або тимчасова debug-кнопка, що запускає `Promise.all([getMe(), getMe()])` через `apiClient`,
- або окремий automated test (unit/integration) для `apiClient` interceptor.

---

## Чеклист

| # | Тест | Категорія | Статус |
|---|------|-----------|--------|
| 1 | Google OAuth flow | Auth Flow | [ ] |
| 2 | Magic Link — новий user | Auth Flow | [ ] |
| 3 | Magic Link — існуючий user | Auth Flow | [ ] |
| 4 | Magic Link — невалідний token | Auth Flow | [ ] |
| 5 | Magic Link — прострочений token | Auth Flow | [ ] |
| 6 | Magic Link — rate limit | Auth Flow | [ ] |
| 7 | Access token expiry + refresh chain | Token Lifecycle | [ ] |
| 8 | Refresh token expiry | Token Lifecycle | [ ] |
| 9 | Token rotation (cookie update) | Token Lifecycle | [ ] |
| 10 | Token rotation (reuse detection) | Token Lifecycle | [ ] |
| 11 | Token rotation (grace period) | Token Lifecycle | [ ] |
| 12 | Protected routes (unauth) | Route Protection | [ ] |
| 13 | Auth route redirect (auth user) | Route Protection | [ ] |
| 14 | Public pages | Route Protection | [ ] |
| 15 | Logout flow | Session Management | [ ] |
| 16 | Logout token invalidation | Session Management | [ ] |
| 17 | Session persistence (F5) | Session Management | [ ] |
| 18 | Concurrent refresh dedup | Session Management | [BLOCKED] |
