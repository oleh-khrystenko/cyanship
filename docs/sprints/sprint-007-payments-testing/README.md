# Sprint 007 — Payments Testing: повне покриття payments flow тестами

## Контекст

Після реалізації sprint-006 (Stripe Checkout, Webhook handling, SubscriptionGuard, Billing page) потрібне комплексне тестування всієї платіжної підсистеми. Цей спринт створює повне покриття: automated (unit + e2e) та manual E2E тести.

Спринт покриває ВСЮ payments підсистему: PaymentsService (checkout, portal, webhook idempotency flow), StripeService (adapter, event mapping), SubscriptionGuard, PaymentsController, frontend API client та billing page.

## Документи

| Файл | Опис |
|------|------|
| [automated-tests.md](./automated-tests.md) | Service prompt для AI агента: створення unit та e2e тестів |
| [manual-test-plan.md](./manual-test-plan.md) | Покрокові сценарії для ручного тестування з чеклистами |

## Scope

### automated-tests.md

Service prompt для AI агента (Claude Code). Описує що тестувати, а не як — агент сам читає кодову базу та пише тести.

- **Backend unit тести:**
  - `payments.service.spec.ts` (новий) — createCheckoutSession, createPortalSession, handleWebhook (idempotency, out-of-order, billing state updates)
  - `payments.controller.spec.ts` (новий) — 3 endpoints, raw body validation, signature check, response format
  - `stripe.service.spec.ts` (новий) — webhook parsing, event type mapping, status mapping, checkout/portal session creation
  - `subscription.guard.spec.ts` (новий) — active/inactive subscription, no user

- **Backend e2e тести:**
  - `payments.e2e-spec.ts` (новий) — HTTP endpoints через Supertest, mocked Stripe + MongoDB

- **Frontend unit тести:**
  - `payments.spec.ts` (новий) — createCheckoutSession, createPortalSession API functions

### manual-test-plan.md

- **A. Checkout Flow** — підписка, вже підписаний, redirect
- **B. Billing Portal** — керування підпискою, no billing account
- **C. Webhook Handling** — checkout.session.completed, subscription.updated, subscription.deleted, idempotency, out-of-order
- **D. SubscriptionGuard** — доступ з/без підписки, 403 response format
- **E. Billing Page UI** — 3 стани (no subscription / active / canceling), i18n
- **F. Route Protection** — /billing protected, redirect
- **G. Billing state after webhooks** — getMe response містить billing

## Залежності

Sprint 007 виконується після повної реалізації sprint-006 (всі 5 фаз).

## Verification

1. `pnpm --filter @lucidkit/types build` — types компілюються
2. `pnpm --filter api test` — всі backend unit тести pass
3. `pnpm --filter api test:e2e` — всі backend e2e тести pass
4. `pnpm --filter web test` — всі frontend unit тести pass
5. `pnpm build` — повний build без помилок
6. Manual: пройти весь чеклист з manual-test-plan.md
