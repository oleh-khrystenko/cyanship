# Sprint 003 Auth: Manual E2E Testing (ручне, вирівняно з поточним кодом)

Дата актуалізації: 2026-02-23

## Що скориговано відносно початкового плану

- Маршрути в застосунку локалізовані (`/{locale}/...`), unprefixed URL можуть давати додатковий redirect через `next-intl` middleware.
- API має глобальний префікс `/api`, тому в Network очікувані запити виду `/api/auth/...`, `/api/users/me`.
- На сторінці `/check` зараз **немає** кнопки `Test Token Refresh`; для token-lifecycle сценаріїв потрібні DevTools (Network/Console).
- UI-повідомлення для rate limit на signin зараз загальне (`Щось пішло не так. Спробуйте ще раз.`), без окремого тексту "зачекайте".
- В email шаблоні бренд і CTA: `LucidKit`, `Увійти в LucidKit`.
- Кнопка logout у Header — icon-only (іконка `LogOut`), `aria-label="Вийти"`, без видимого тексту.
- Logout використовує `window.location.href` (hard navigation / повне перезавантаження), а не client-side router.
- Response format: `{ data: { ... } }` для success, `{ error: { code, message } }` для errors.

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
- [ ] Після consent API встановлює `bid_refresh` cookie і робить redirect на `/auth/callback` (без locale; middleware додає locale)
- [ ] Callback page виконує: `POST /api/auth/refresh` -> `200`, отримано `accessToken`
- [ ] Network: `GET /api/users/me` -> `200`, отримано профіль
- [ ] Redirect на `/{locale}/check`
- [ ] `Application -> Cookies`: `bid_refresh` присутній (`httpOnly`, `path=/`, `sameSite=lax`, `secure` тільки в production)
- [ ] Header показує ім'я або email, avatar (або ініціал у круглому бейджі), та `{balance} кредитів`
- [ ] URL: `/{locale}/check`, не `/{locale}/auth/signin`

---

### Тест 2: Google OAuth — відмова consent

**Мета:** Перевірити поведінку при відмові користувача на Google consent screen

**Precondition:** Не авторизований

**Steps:**

1. Перейти на `/{locale}/auth/signin`
2. Натиснути `Продовжити з Google`
3. На Google consent screen натиснути "Відхилити" / закрити вікно

**Expected:**

- [ ] Redirect назад на callback page або error page
- [ ] `bid_refresh` cookie НЕ встановлено
- [ ] Auth state не змінюється (user = null)
- [ ] Redirect на `/{locale}/auth/signin`

---

### Тест 3: Magic Link — повний flow (новий користувач)

**Мета:** Перевірити вхід через email для нового користувача

**Precondition:** Не авторизований, email ще не реєструвався

**Steps:**

1. Перейти на `/{locale}/auth/signin`
2. Ввести email
3. Натиснути `Надіслати Magic Link`
4. Відкрити email і клікнути `Увійти в LucidKit`

**Expected:**

- [ ] Після submit UI переходить у `sent` state (`Перевірте пошту`)
- [ ] Network: `POST /api/auth/magic-link/send` -> `200`
- [ ] Email отримано
- [ ] Клік по лінку відкриває `/auth/verify?token=...` (middleware додає locale)
- [ ] Network: `POST /api/auth/magic-link/verify` -> `200`, response `{ data: { user, accessToken } }`
- [ ] Network: `GET /api/users/me` -> `200` (verify page викликає `getMe()` після verify)
- [ ] `Application -> Cookies`: `bid_refresh` встановлено
- [ ] Redirect на `/{locale}/check`
- [ ] Header показує дані користувача
- [ ] MongoDB: створено новий `User` документ з цим email

---

### Тест 4: Magic Link — повний flow (існуючий користувач)

**Мета:** Переконатись, що повторний вхід не дублює User

**Precondition:** Не авторизований, email з Тесту 3

**Steps:**

1. Пройти Magic Link flow тим самим email

**Expected:**

- [ ] Вхід успішний, профіль той самий
- [ ] MongoDB: документ користувача один (без дублю)
- [ ] `credits.balance` та `freeReportUsed` збережені

---

### Тест 5: Magic Link — невалідний token

**Мета:** Перевірити обробку підробленого або вже використаного token

**Precondition:** Не авторизований

**Steps:**

1. Відкрити: `/{locale}/auth/verify?token=fakeinvalidtoken123`

**Expected:**

- [ ] Network: `POST /api/auth/magic-link/verify` -> `401`
- [ ] Verify сторінка показує помилку: "Посилання недійсне або прострочене"
- [ ] Опис: "Посилання для входу, яке ви використали, більше не дійсне. Будь ласка, запросіть нове."
- [ ] Кнопка `Спробувати знову` веде на `/{locale}/auth/signin`
- [ ] `bid_refresh` cookie НЕ встановлено

---

### Тест 6: Magic Link — verify page без token параметру

**Мета:** Перевірити поведінку verify page при відсутності `?token=` в URL

**Precondition:** Не авторизований

**Steps:**

1. Відкрити: `/{locale}/auth/verify` (без `?token=`)

**Expected:**

- [ ] Network: жодного запиту на `/api/auth/magic-link/verify` (код перевіряє `token` перед запитом)
- [ ] Одразу показується error UI: "Посилання недійсне або прострочене"
- [ ] Кнопка `Спробувати знову` веде на `/{locale}/auth/signin`

---

### Тест 7: Magic Link — прострочений token (>15 хв)

**Мета:** Переконатись, що token TTL 15 хв працює

**Precondition:** Надіслано Magic Link, але не відкрито

**Steps:**

1. Надіслати Magic Link
2. Почекати 16+ хвилин (Redis TTL `magic:{token}` = 900s)
3. Клікнути лінк з email

**Expected:**

- [ ] Network: `POST /api/auth/magic-link/verify` -> `401` (`Invalid or expired magic link token`)
- [ ] Verify сторінка показує помилку
- [ ] `bid_refresh` cookie НЕ встановлено

---

### Тест 8: Magic Link — one-time use

**Мета:** Перевірити, що magic link працює лише один раз (token видаляється з Redis після верифікації)

**Precondition:** Не авторизований, є свіжий magic link

**Steps:**

1. Надіслати Magic Link
2. Відкрити лінк з email → успішна верифікація
3. Вийти (logout)
4. Відкрити той самий лінк повторно

**Expected:**

- [ ] Крок 2: verify -> `200`, вхід успішний
- [ ] Крок 4: verify -> `401` (`Invalid or expired magic link token`)
- [ ] Verify сторінка показує помилку
- [ ] Token використано — Redis key `magic:{token}` видалено після першого verify

---

### Тест 9: Magic Link — rate limit (3 за 15 хв)

**Мета:** Перевірити anti-abuse ліміт

**Precondition:** Не авторизований

**Steps:**

1. Перейти на `/{locale}/auth/signin`, ввести email, натиснути `Надіслати Magic Link` (1-й)
2. **Перезавантажити сторінку** (UI ховає форму після `sent` state), ввести той самий email, надіслати (2-й)
3. **Перезавантажити сторінку**, ввести той самий email, надіслати (3-й)
4. **Перезавантажити сторінку**, ввести той самий email, надіслати (4-й)

> **Увага:** Після кожного успішного відправлення UI переходить у `sent` state і ховає форму. Для повторного надсилання потрібно перезавантажити сторінку (`F5`).

**Expected:**

- [ ] 1-3 запити: `POST /api/auth/magic-link/send` -> `200`, UI в `sent` state
- [ ] 4-й запит: `POST /api/auth/magic-link/send` -> `429`
- [ ] UI показує загальну помилку: "Щось пішло не так. Спробуйте ще раз."

---

## B. Token Lifecycle

### Тест 10: Access Token expiry + refresh chain (через DevTools)

**Мета:** Перевірити, що expired access token більше не валідний, а refresh видає новий

**Precondition:** access TTL = `1m`, refresh TTL = `2m`, авторизований

**Steps:**

1. Авторизуватись
2. У `Network` знайти останній `POST /api/auth/refresh`, скопіювати `accessToken` з response (`access_old`)
3. Почекати 1+ хв
4. У Console викликати:
   ```js
   fetch('/api/users/me', { headers: { Authorization: 'Bearer <access_old>' } })
   ```
5. Викликати:
   ```js
   fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
   ```
6. З response взяти новий `accessToken`, повторити `GET /api/users/me`

**Expected:**

- [ ] Крок 4: `GET /api/users/me` з `access_old` -> `401`
- [ ] Крок 5: `POST /api/auth/refresh` -> `200` і повертає новий `accessToken`
- [ ] Крок 6: `GET /api/users/me` з новим access -> `200`
- [ ] `bid_refresh` cookie оновлюється (rotation)

---

### Тест 11: Refresh Token expiry (примусовий logout path)

**Мета:** Переконатись, що після expiry refresh token сесія не відновлюється

**Precondition:** access TTL = `1m`, refresh TTL = `2m`, авторизований

**Steps:**

1. Авторизуватись
2. Почекати 2+ хв (обидва токени прострочені)
3. Перезавантажити сторінку на `/{locale}/check`

**Expected:**

- [ ] `AuthInitializer` намагається `POST /api/auth/refresh` -> `401` (`Invalid or expired refresh token`)
- [ ] Response містить `Set-Cookie` що видаляє `bid_refresh` (controller catch block `clearCookie`)
- [ ] `Application -> Cookies`: `bid_refresh` відсутній
- [ ] Auth store: `clearUser()` спрацює через interceptor `.catch()` в `client.ts`
- [ ] `AuthGuard` перенаправляє на `/{locale}/auth/signin`

---

### Тест 12: Token Rotation — cookie змінюється при refresh

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

### Тест 13: Token Rotation — reuse detection

**Мета:** Перевірити захист від повторного використання ротованого refresh token

**Precondition:** access TTL = `1m`, авторизований

**Steps:**

1. Авторизуватись, скопіювати `bid_refresh` (`cookie_old`)
2. Зробити refresh і дочекатись нової cookie (`cookie_new`)
3. Почекати 11+ секунд (щоб вийти за `ROTATION_GRACE_PERIOD=10s` — Redis TTL на `rotated` key сплив)
4. Вручну підставити `cookie_old` в `Application -> Cookies`
5. Викликати `POST /api/auth/refresh` (наприклад F5)

**Expected:**

- [ ] `POST /api/auth/refresh` -> `401` (`Refresh token reuse detected`)
- [ ] Response очищає `bid_refresh` cookie
- [ ] **Критично:** `revokeAllUserTokens()` видаляє ВСІ активні refresh tokens цього користувача
- [ ] Поточна сесія (з `cookie_new`) також стає невалідною
- [ ] Потрібен повний повторний логін

---

### Тест 14: Token Rotation — grace period (concurrent tabs)

**Мета:** Перевірити tolerated refresh у двох табах в межах grace window

**Precondition:** access TTL = `1m`, авторизований

**Steps:**

1. Відкрити два таби на `/{locale}/check`
2. В обох табах мати однакову refresh cookie
3. У табі A викликати refresh (F5)
4. У табі B викликати refresh протягом 10 сек після кроку 3 (F5)

**Expected:**

- [ ] Таб A: `POST /api/auth/refresh` -> `200`
- [ ] Таб B: `POST /api/auth/refresh` -> `200` (за рахунок grace period — Redis key має значення `rotated`)
- [ ] Reuse detection не спрацював

**Negative branch (окремий прогін):**

5. Повторити сценарій, але в табі B викликати refresh через 11+ сек

- [ ] Таб B: `POST /api/auth/refresh` -> `401` (reuse detected, Redis key `rotated` вже видалено за TTL)

---

## C. Route Protection

### Тест 15: Protected routes — неавторизований користувач

**Мета:** Перевірити middleware захист (server-side redirect)

**Precondition:** Немає `bid_refresh`

**Steps:**

1. Відкрити `/{locale}/check`
2. Відкрити `/{locale}/pay`

**Expected:**

- [ ] Для обох URL: middleware redirect на `/{locale}/auth/signin` (server-side, не 200 з контентом)
- [ ] Сторінки protected контенту не рендеряться
- [ ] Двошаровий захист: навіть якщо middleware пропустить, `AuthGuard` на client-side також перенаправить

---

### Тест 16: Auth route — авторизований користувач

**Мета:** Перевірити, що авторизований юзер не залишається на signin

**Precondition:** Є валідний `bid_refresh`

**Steps:**

1. Відкрити `/{locale}/auth/signin`

**Expected:**

- [ ] Middleware redirect на `/{locale}/check` (server-side, перевіряє наявність `bid_refresh` cookie)
- [ ] Signin форма не рендериться
- [ ] Додатково: signin page має client-side redirect через `useEffect` якщо `isAuthenticated = true`

---

### Тест 17: Публічні сторінки — доступ для всіх

**Мета:** Перевірити доступність landing + signin

**Precondition:** Не авторизований

**Steps:**

1. Відкрити `/` (або `/{locale}`)
2. Відкрити `/{locale}/auth/signin`

**Expected:**

- [ ] `/` може зробити locale-redirect (`/uk`), далі landing доступний
- [ ] `/{locale}/auth/signin` доступний без авторизації
- [ ] Header показує кнопку `Увійти`

**Precondition:** Авторизований

- [ ] `/{locale}` доступний (landing публічний)
- [ ] Header показує профіль користувача (ім'я/email, avatar, кредити)

---

### Тест 18: Auth utility routes — доступність verify/callback

**Мета:** Перевірити що `/auth/verify` та `/auth/callback` не блокуються middleware

**Precondition:** Не авторизований

**Steps:**

1. Відкрити `/{locale}/auth/verify?token=test123`
2. Відкрити `/{locale}/auth/callback`

**Expected:**

- [ ] `/auth/verify` — сторінка рендериться (не redirect на signin). Verify робить запит і показує error для невалідного token
- [ ] `/auth/callback` — сторінка рендериться, `refreshToken()` fail -> redirect на signin
- [ ] Ці шляхи НЕ входять до `AUTH_PATHS` і `PROTECTED_PATHS` у middleware

---

## D. Session Management

### Тест 19: Logout — повний flow

**Мета:** Перевірити очищення сесії на сервері і клієнті

**Precondition:** Авторизований, на `/{locale}/check`

**Steps:**

1. Натиснути іконку logout (LogOut icon) в Header
2. Спробувати перейти на `/{locale}/check`

**Expected:**

- [ ] Network: `POST /api/auth/logout` -> `200`, response `{ data: { message: 'Logged out' } }`
- [ ] Response містить `Set-Cookie` що очищає `bid_refresh`
- [ ] `Application -> Cookies`: `bid_refresh` видалено
- [ ] Клієнтський auth state очищений (`clearUser()` викликається після logout)
- [ ] Відбувається **hard navigation** на `/{locale}` (landing) через `window.location.href` — повне перезавантаження сторінки
- [ ] `AuthInitializer` виконається знову при reload, `refreshToken()` fail → user залишається неавторизованим
- [ ] Повторний перехід на `/{locale}/check` → middleware redirect на `/{locale}/auth/signin`

---

### Тест 20: Logout — старий token не працює + reuse detection

**Мета:** Переконатись, що logout ревокує refresh token та reuse detection захищає нову сесію

**Precondition:** Авторизований

**Steps:**

1. Скопіювати `bid_refresh` (`cookie_old`)
2. Натиснути іконку logout
3. Залогінитись знову (нова сесія, нова `bid_refresh`)
4. Підставити вручну `cookie_old` через `Application -> Cookies`
5. Викликати `POST /api/auth/refresh` (F5)

**Expected:**

- [ ] `POST /api/auth/refresh` зі старим токеном -> `401`
- [ ] **Критично:** оскільки `refresh:${jti}` видалено при logout, спрацює `revokeAllUserTokens()` — це видалить **ВСІ** токени користувача, включаючи нову сесію з кроку 3
- [ ] Нова сесія також стає невалідною — потрібен повторний логін
- [ ] Redirect на `/{locale}/auth/signin`

---

### Тест 21: Session persistence — перезавантаження сторінки

**Мета:** Перевірити відновлення сесії через `AuthInitializer`

**Precondition:** Авторизований, на `/{locale}/check`

**Steps:**

1. Натиснути `F5`

**Expected:**

- [ ] `AuthInitializer` виконується (useRef guard — тільки один раз)
- [ ] Network: `POST /api/auth/refresh` -> `200`
- [ ] Network: `GET /api/users/me` -> `200`
- [ ] Header: спочатку loading skeleton (animate-pulse), потім профіль
- [ ] `AuthGuard` показує `UiSpinner` поки `isLoading = true`
- [ ] Cookie `bid_refresh` ротується (нове значення)

---

### Тест 22: Concurrent requests — dedup refresh у frontend client

**Мета:** Перевірити dedup логіку `refreshPromise` у `apiClient`

**Статус:** `BLOCKED` для чисто ручного E2E в поточному UI.

**Причина блокування:** на `/{locale}/check` немає debug-trigger, який ініціює два паралельні protected запити через `apiClient`; відповідно dedup з `shared/api/client.ts` не спостерігається напряму.

**Що потрібно для розблокування:**

- або тимчасова debug-кнопка, що запускає `Promise.all([getMe(), getMe()])` через `apiClient`,
- або окремий automated test (unit/integration) для `apiClient` interceptor.

**Поведінка для перевірки (коли розблоковано):**

- `refreshPromise` shared між interceptors — лише один `POST /api/auth/refresh`
- Другий 401-запит чекає на результат першого refresh
- Обидва запити отримують новий access token і retry

---

## Чеклист

| # | Тест | Категорія | Статус |
|---|------|-----------|--------|
| 1 | Google OAuth flow | Auth Flow | [ ] |
| 2 | Google OAuth — відмова consent | Auth Flow | [ ] |
| 3 | Magic Link — новий user | Auth Flow | [ ] |
| 4 | Magic Link — існуючий user | Auth Flow | [ ] |
| 5 | Magic Link — невалідний token | Auth Flow | [ ] |
| 6 | Magic Link — verify без token | Auth Flow | [ ] |
| 7 | Magic Link — прострочений token | Auth Flow | [ ] |
| 8 | Magic Link — one-time use | Auth Flow | [ ] |
| 9 | Magic Link — rate limit | Auth Flow | [ ] |
| 10 | Access token expiry + refresh chain | Token Lifecycle | [ ] |
| 11 | Refresh token expiry | Token Lifecycle | [ ] |
| 12 | Token rotation (cookie update) | Token Lifecycle | [ ] |
| 13 | Token rotation (reuse detection) | Token Lifecycle | [ ] |
| 14 | Token rotation (grace period) | Token Lifecycle | [ ] |
| 15 | Protected routes (unauth) | Route Protection | [ ] |
| 16 | Auth route redirect (auth user) | Route Protection | [ ] |
| 17 | Public pages | Route Protection | [ ] |
| 18 | Auth utility routes (verify/callback) | Route Protection | [ ] |
| 19 | Logout flow | Session Management | [ ] |
| 20 | Logout token invalidation + reuse | Session Management | [ ] |
| 21 | Session persistence (F5) | Session Management | [ ] |
| 22 | Concurrent refresh dedup | Session Management | [BLOCKED] |
