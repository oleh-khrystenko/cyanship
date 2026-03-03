# Automated Tests — Service Prompt для AI агента

> Промпт для Claude Code або іншого AI агента. Мета: створити автоматизовані тести, які максимально покриють payments flow, реалізований у sprint-006.

---

## Мета

Створити unit та e2e тести для повного покриття платіжної підсистеми LucidKit. Source of truth для всіх сценаріїв — реальний код у `apps/api/src/modules/payments/` та `apps/web/src/shared/api/payments.ts`.

**Scope:**

- Backend unit тести (PaymentsService, PaymentsController, StripeService, SubscriptionGuard)
- Backend e2e тести (HTTP endpoints через Supertest)
- Frontend unit тести (API client функції)

---

## Порядок виконання

Виконуй задачі послідовно. Кожен крок залежить від попереднього.

### Крок 1: Вивчи кодову базу

Перш ніж писати будь-який тест — прочитай і зрозумій:

1. **Імплементацію** — зрозумій реальні сигнатури методів, логіку, edge cases:
   - `apps/api/src/modules/payments/payments.service.ts` — основна логіка (createCheckoutSession, createPortalSession, handleWebhook + private методи)
   - `apps/api/src/modules/payments/payments.controller.ts` — 3 endpoints, raw body, signature validation
   - `apps/api/src/modules/payments/providers/stripe.service.ts` — Stripe adapter, event parsing, status mapping
   - `apps/api/src/modules/payments/interfaces/payment-provider.interface.ts` — IPaymentProvider інтерфейс
   - `apps/api/src/modules/payments/schemas/processed-webhook-event.schema.ts` — Mongoose schema для idempotency
   - `apps/api/src/common/guards/subscription.guard.ts` — SubscriptionGuard
   - `apps/api/src/modules/users/schemas/user.schema.ts` — User schema з billing subdocument
2. **Існуючі тести** — зрозумій patterns мокування, структуру, стиль assertions:
   - `apps/api/src/modules/auth/auth.service.spec.ts` — патерн мокування Mongoose Model + Redis
   - `apps/api/src/modules/auth/auth.controller.spec.ts` — патерн мокування Controller + Response object
   - `apps/api/src/modules/users/users.service.spec.ts` — патерн мокування findById, lean()
   - `apps/api/test/app.e2e-spec.ts` — патерн MongoMemoryServer + NestJS test app
   - `apps/api/test/auth.e2e-spec.ts` — патерн stateful mocks в e2e
3. **Types з packages/types:**
   - `packages/types/src/contracts/payments.ts` — SUBSCRIPTION_STATUS, BILLING_EVENT_TYPE, BillingWebhookEvent
   - `packages/types/src/enums/response-code.ts` — ALREADY_SUBSCRIBED, NO_BILLING_ACCOUNT, SUBSCRIPTION_REQUIRED
4. **Frontend:**
   - `apps/web/src/shared/api/payments.ts` — createCheckoutSession, createPortalSession
   - `apps/web/src/shared/api/client.ts` — apiClient instance

### Крок 2: Backend unit тести
### Крок 3: Backend e2e тести
### Крок 4: Frontend unit тести

---

## Constraints (обов'язкові правила)

1. **НЕ змінюй існуючі тести.** Тільки додавай нові файли.
2. **Дотримуйся існуючих patterns.** Мокування Mongoose Model (getModelToken, jest.fn()), mock provider через DI — копіюй з існуючих spec файлів.
3. **Читай реальний код перед написанням тесту.** Перевіряй сигнатури методів, назви полів, MongoDB error codes, HTTP статуси — бери з імплементації.
4. **Один тест = одна поведінка.** Не перевіряй кілька речей в одному `it()`.
5. **Слідуй проектним конвенціям** — прочитай `CLAUDE.md` в корені проекту.
6. **Запускай тести після кожного файлу.** Переконайся, що нові тести проходять.
7. **Не додавай нові залежності до API** без необхідності. Все потрібне вже є.
8. **НЕ мокуй реальний Stripe SDK.** Мокуй `IPaymentProvider` через DI token (`PAYMENT_PROVIDER`), не `StripeService` напряму. StripeService тестується окремо з мокованим `stripe` module.

---

## Крок 2: Backend Unit Tests

### 2.1 НОВИЙ: `apps/api/src/modules/payments/payments.service.spec.ts`

Створи новий файл. Прочитай `payments.service.ts` щоб зрозуміти всі залежності та логіку.

**Мокування:**
- `PAYMENT_PROVIDER` token — mock об'єкт з `createCheckoutSession`, `createPortalSession`, `handleWebhookPayload` як `jest.fn()`
- `userModel` — через `getModelToken(User.name)`, methods: `findById`, `findOne`, `findByIdAndUpdate` як `jest.fn()`
- `webhookEventModel` — через `getModelToken(ProcessedWebhookEvent.name)`, method: `create` як `jest.fn()`
- Для методів що повертають документ: `findById().lean()` через chainable mock

**Метод `createCheckoutSession`:**
- Юзер без підписки → викликає `paymentProvider.createCheckoutSession` з правильними аргументами (userId, userEmail, planCode, successUrl, cancelUrl) → повертає `{ checkoutUrl }`
- Юзер з активною підпискою (`hasActiveSubscription: true`) → кидає `ConflictException` з `code: RESPONSE_CODE.ALREADY_SUBSCRIBED`
- Юзер не знайдений → кидає `BadRequestException`
- Перевір що `successUrl` і `cancelUrl` беруться з `ENV`

**Метод `createPortalSession`:**
- Юзер з `providerCustomerId` → викликає `paymentProvider.createPortalSession(providerCustomerId)` → повертає `{ portalUrl }`
- Юзер без `billing` subdocument → кидає `BadRequestException` з `code: RESPONSE_CODE.NO_BILLING_ACCOUNT`
- Юзер з `billing.providerCustomerId: null` → кидає `BadRequestException` з `code: RESPONSE_CODE.NO_BILLING_ACCOUNT`
- Юзер не знайдений → кидає `BadRequestException`

**Метод `handleWebhook` — basic flow:**
- `paymentProvider.handleWebhookPayload` повертає `null` → метод повертає без дій (unknown event)
- Повний happy path для `CHECKOUT_COMPLETED`:
  1. `handleWebhookPayload` повертає event з userId і типом CHECKOUT_COMPLETED
  2. `webhookEventModel.create` успішно вставляє (не дублікат)
  3. `userModel.findById` знаходить user без `lastProviderEventAt`
  4. `userModel.findByIdAndUpdate` викликається з правильним `$set` що включає `billing.provider: 'stripe'`, `billing.hasActiveSubscription: true`, `billing.providerCustomerId`, `billing.providerSubscriptionId`, `billing.planCode`, `billing.currency`

**Метод `handleWebhook` — userId resolution:**
- Event з непустим `userId` → використовується напряму, `userModel.findOne` НЕ викликається
- Event з порожнім `userId` але `raw.id` є → шукає user через `findOne({ 'billing.providerSubscriptionId': raw.id })` → повертає userId
- Event з порожнім `userId` і без `raw.id` → log warning, повертає без дій
- `findOne` не знаходить user для subscriptionId → log warning, повертає без дій

**Метод `handleWebhook` — idempotency:**
- `webhookEventModel.create` кидає MongoDB duplicate key error (code 11000) → повертає без дій (already processed)
- `webhookEventModel.create` кидає інший error → помилка пропагується

**Метод `handleWebhook` — out-of-order:**
- `event.occurredAt < user.billing.lastProviderEventAt` → skip (stale event), `findByIdAndUpdate` НЕ викликається
- `event.occurredAt === user.billing.lastProviderEventAt` → обробляється (рівні timestamps дозволені, логіка `<` а не `<=`)
- `event.occurredAt > user.billing.lastProviderEventAt` → обробляється нормально

**Метод `handleWebhook` — billing state per event type:**
- `CHECKOUT_COMPLETED`: `billing.provider = 'stripe'`, `billing.providerCustomerId`, `billing.providerSubscriptionId`, `billing.planCode` з `raw.metadata.planCode`, `billing.currency`, `billing.hasActiveSubscription = true`
- `SUBSCRIPTION_UPDATED` з status ACTIVE: `billing.hasActiveSubscription = true`, оновлення `subscriptionStatus`, `currentPeriodEnd`, `cancelAtPeriodEnd`
- `SUBSCRIPTION_UPDATED` з status PAST_DUE: `billing.hasActiveSubscription = false`
- `SUBSCRIPTION_DELETED`: `billing.subscriptionStatus = 'CANCELED'`, `billing.hasActiveSubscription = false`, `billing.providerSubscriptionStatus = 'canceled'`

**Метод `handleWebhook` — user not found after idempotency:**
- `userModel.findById` повертає null → log warning, повертає без дій, `findByIdAndUpdate` НЕ викликається

### 2.2 НОВИЙ: `apps/api/src/modules/payments/payments.controller.spec.ts`

Створи новий файл. Прочитай `payments.controller.ts`.

**Мокування:** Mock `PaymentsService` повністю. Mock `Request` object з `rawBody` (Buffer), `headers`. Mock `@CurrentUser()` через `request.user`.

| Endpoint | Що тестувати |
|---|---|
| `POST /payments/checkout-session` | Виклик `paymentsService.createCheckoutSession(user._id.toString(), dto.planCode)`. Response format `{ data: { checkoutUrl } }`. Без JWT guard (мокований на рівні unit тесту). |
| `POST /payments/portal-session` | Виклик `paymentsService.createPortalSession(user._id.toString())`. Response format `{ data: { portalUrl } }`. |
| `POST /payments/webhook/stripe` | Успішна обробка — передає `provider='stripe'`, `rawBody`, `signature` в `paymentsService.handleWebhook`; повертає `{ received: true }`. |
| `POST /payments/webhook/stripe` | Missing `rawBody` (req.rawBody = undefined) → кидає `BadRequestException`. |
| `POST /payments/webhook/stripe` | Missing `signature` (header відсутній) → кидає `BadRequestException`. |
| `POST /payments/webhook/unknown` | Unsupported provider → кидає `BadRequestException` з message `Unsupported provider: unknown`. |

### 2.3 НОВИЙ: `apps/api/src/modules/payments/providers/stripe.service.spec.ts`

Створи новий файл. Прочитай `stripe.service.ts`.

**Мокування:** Mock весь `stripe` module через `jest.mock('stripe')`. Конструктор повертає mock об'єкт з `checkout.sessions.create`, `billingPortal.sessions.create`, `webhooks.constructEvent` як `jest.fn()`.

**Метод `createCheckoutSession`:**
- Передає правильний `price` (з `ENV.STRIPE_PRICE_ONE_OFF_USD`), `metadata.userId`, `metadata.planCode`, `client_reference_id`, `success_url`, `cancel_url`
- `session.url` є → повертає `{ checkoutUrl: session.url, providerSessionId: session.id }`
- `session.url` відсутній → кидає Error

**Метод `createPortalSession`:**
- Передає `customer: providerCustomerId`, `return_url: ENV.BILLING_SUCCESS_URL`
- Повертає `{ portalUrl: session.url }`

**Метод `handleWebhookPayload`:**
- `checkout.session.completed` → повертає event з `type: CHECKOUT_COMPLETED`, `userId` з `metadata.userId`, `raw` містить session object
- `checkout.session.completed` без `metadata.userId` → fallback до `client_reference_id`
- `customer.subscription.updated` з status `active` → повертає event з `type: SUBSCRIPTION_UPDATED`, `subscriptionStatus: ACTIVE`, `userId: ''` (порожній, бо subscription event)
- `customer.subscription.updated` з status `past_due` → `subscriptionStatus: PAST_DUE`
- `customer.subscription.updated` з status `canceled` → `subscriptionStatus: CANCELED`
- `customer.subscription.deleted` → повертає event з `type: SUBSCRIPTION_DELETED`, `subscriptionStatus: CANCELED`
- Невідомий event type (напр. `payment_intent.created`) → повертає `null`

**Метод `mapSubscriptionStatus` (через handleWebhookPayload):**
- `'active'` → `ACTIVE`
- `'trialing'` → `TRIALING`
- `'past_due'` → `PAST_DUE`
- `'canceled'` → `CANCELED`
- `'incomplete'` → `INCOMPLETE`
- `'unpaid'` → `UNPAID`
- `'incomplete_expired'` → `CANCELED`
- `'paused'` → `UNKNOWN`
- Невідомий статус → `UNKNOWN`

### 2.4 НОВИЙ: `apps/api/src/common/guards/subscription.guard.spec.ts`

Створи новий файл. Прочитай `subscription.guard.ts`.

**Мокування:** Mock `ExecutionContext` → `switchToHttp().getRequest()` повертає mock Request з `user`.

| Сценарій | Expected |
|---|---|
| `user.billing.hasActiveSubscription === true` | `canActivate` повертає `true` |
| `user.billing.hasActiveSubscription === false` | Кидає `ForbiddenException` з `{ code: RESPONSE_CODE.SUBSCRIPTION_REQUIRED }` |
| `user.billing === null` | Кидає `ForbiddenException` |
| `user.billing === undefined` | Кидає `ForbiddenException` |
| `user === undefined` (no JWT user) | Кидає `ForbiddenException` |
| `user.billing.hasActiveSubscription === true` (TRIALING) | `canActivate` повертає `true` — Guard тільки перевіряє `hasActiveSubscription`, не розрізняє статуси |

---

## Крок 3: Backend E2E Tests

### Файл: `apps/api/test/payments.e2e-spec.ts`

Прочитай існуючий `apps/api/test/app.e2e-spec.ts` та `apps/api/test/auth.e2e-spec.ts`. Зрозумій:
- Як налаштований `MongoMemoryServer`
- Як мокується Redis (`REDIS_CLIENT` provider override)
- Як ініціалізується NestJS app з `overrideProvider`

**КРИТИЧНО:** Stripe SDK у e2e НЕ можна використовувати з реальними credentials. Замінити `PAYMENT_PROVIDER` через `overrideProvider(PAYMENT_PROVIDER).useValue(mockPaymentProvider)` де `mockPaymentProvider` — простий mock об'єкт.

**Налаштування:**

```
beforeAll:
  - MongoMemoryServer.create()
  - Test.createTestingModule(AppModule)
  - overrideProvider(PAYMENT_PROVIDER).useValue({
      createCheckoutSession: jest.fn().mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/...', providerSessionId: 'cs_test_xxx' }),
      createPortalSession: jest.fn().mockResolvedValue({ portalUrl: 'https://billing.stripe.com/...' }),
      handleWebhookPayload: jest.fn().mockReturnValue(null),
    })
  - mock ENV.STRIPE_* vars (вже в process.env з test setup або .env.test)
  - Скористатись helper loginAsMagicLink або loginWithPassword з auth.e2e-spec.ts
```

**Хелпер-функції (аналогічно auth.e2e-spec.ts):**
- `createUserWithBilling(email, billingData?)` — створює user в MongoDB з опціональним billing subdocument
- `loginAsUser(email)` — повертає `{ accessToken }` для захищених запитів

**Сценарії:**

**А. `POST /api/payments/checkout-session` (JWT protected):**
- Авторизований, без активної підписки, валідний planCode → 201, `{ data: { checkoutUrl: '...' } }`
- Авторизований, вже має активну підписку → 409, `{ error: { code: 'ALREADY_SUBSCRIBED' } }`
- Без JWT token → 401
- Невалідний body (без planCode) → 400
- Порожній planCode (`""`) → 400

**Б. `POST /api/payments/portal-session` (JWT protected):**
- Авторизований, є `billing.providerCustomerId` → 201, `{ data: { portalUrl: '...' } }`
- Авторизований, немає billing subdocument → 400, `{ error: { code: 'NO_BILLING_ACCOUNT' } }`
- Авторизований, `billing.providerCustomerId === null` → 400, `{ error: { code: 'NO_BILLING_ACCOUNT' } }`
- Без JWT token → 401

**В. `POST /api/payments/webhook/stripe` (NO auth, NO throttle):**
- **ВАЖЛИВО:** У e2e mock `handleWebhookPayload` щоб повертав BillingWebhookEvent для перевірки idempotency та billing state.
- Валідний request (rawBody + signature) → mock `handleWebhookPayload` повертає null (unknown event) → 200/201, `{ received: true }`
- Missing `stripe-signature` header → 400
- Missing rawBody (неможливо напряму в Supertest — перевірити fallback)
- Unsupported provider (`/webhook/monobank`) → 400

**Г. Response format (cross-cutting):**
- Success: `{ data: { ... } }`
- Error: `{ error: { code: string, message: string } }`
- Validation error (невалідний body) → 400 з правильним форматом

**Д. Webhook idempotency (якщо mock підтримує state):**
- Налаштувати `handleWebhookPayload` mock повертати реальний CHECKOUT_COMPLETED event
- Перший webhook → 201, billing оновлюється в MongoDB
- Той самий webhook повторно → 201 (idempotent), `{ received: true }`, duplicate key error handling

---

## Крок 4: Frontend Unit Tests

### 4.1 НОВИЙ: `apps/web/src/shared/api/payments.spec.ts`

Прочитай `apps/web/src/shared/api/payments.ts` та існуючий `apps/web/src/shared/api/auth.spec.ts` щоб зрозуміти pattern мокування.

Mock `apiClient` через jest.mock('./client') або через moduleNameMapper в jest config.

| Функція | Що перевірити |
|---|---|
| `createCheckoutSession(planCode)` | POST `/api/payments/checkout-session` з `{ planCode }` в body. Повертає `data.data` (тобто `{ checkoutUrl }`). |
| `createCheckoutSession('monthly_usd')` | Правильний planCode передається в тіло запиту. |
| `createPortalSession()` | POST `/api/payments/portal-session` без body. Повертає `{ portalUrl }`. |
| API error | Якщо `apiClient.post` відкидає — error пропагується (не поглинається). |

---

## Верифікація

Після завершення всіх кроків:

```bash
# 1. Backend unit tests
pnpm --filter api test

# 2. Backend e2e tests
pnpm --filter api test:e2e

# 3. Frontend unit tests
pnpm --filter web test

# 4. Coverage report
pnpm --filter api test:cov
# Target: >80% coverage для payments module

# 5. Full build (переконатися що нічого не зламано)
pnpm build
```

**Критерії успіху:**
- Всі тести проходять (exit code 0)
- Нові тести покривають всі payments flows: checkout, portal, webhook (всі event types), idempotency, out-of-order, guard
- Існуючі тести не змінені та все ще проходять
- Жоден тест не залежить від зовнішніх сервісів (Stripe API, MongoDB Atlas)
- Coverage payments module > 80%
