# Конфігурація

## Env vars (required, crash if missing)

Файл: `apps/api/src/config/env.ts`

| Змінна | Опис |
|--------|------|
| `STRIPE_SECRET_KEY` | Stripe API secret key (використовують `StripeService` і `CatalogService`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret |
| `WEB_URL` | База для success/cancel URL checkout-сесії та return URL білінг-порталу |

Інших payments env vars немає. Ціни, кількість executions, порядок відображення і featured-позначка живуть у metadata Stripe Products і читаються `CatalogService` — див. [13-catalog.md](./13-catalog.md).

## Константи (не env)

| Константа | Файл | Значення |
|-----------|------|----------|
| `PAYMENTS_SUBSCRIPTION_ENABLED` | `packages/types/src/constants/payments.ts` | `true` |
| `PAYMENTS_ONE_OFF_ENABLED` | `packages/types/src/constants/payments.ts` | `true` |
| `SUBSCRIPTION_PLAN_CODES` | `packages/types/src/contracts/payments.ts` | `['starter', 'pro']` |
| `EXECUTION_PACK_CODES` | `packages/types/src/contracts/payments.ts` | `['basic', 'max']` |

Прапорці — спільні для API і web, деталі в `09-feature-flags.md`.

## test-setup.ts

Файл: `apps/api/src/test-setup.ts`

Встановлює placeholder Stripe env vars (`sk_test_placeholder`, `whsec_test_placeholder`) для тестів. Без цього fail-fast policy крашить тести при імпорті `env.ts`. Прапорці оплати в test-setup відсутні — це константи, тести за потреби мокають `@cyanship/types`.
