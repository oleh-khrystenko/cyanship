# Sprint 007 — One-Off Payments

## Мета

Додати одноразові (one-off) платежі поряд з існуючою підписковою моделлю. Користувач може:
1. Купити **підписку** (subscription) — щомісячний доступ
2. Купити **кредитний пакет** (one-off) — фіксована кількість кредитів за разову оплату

Обидва типи можна незалежно вимкнути через env vars без змін коду.

## Статус фаз

| Фаза | Файл | Статус |
|------|------|--------|
| 1 | [phase-1-types-env.md](./phase-1-types-env.md) | ⬜ pending |
| 2 | [phase-2-stripe-adapter.md](./phase-2-stripe-adapter.md) | ⬜ pending |
| 3 | [phase-3-payments-core.md](./phase-3-payments-core.md) | ⬜ pending |
| 4 | [phase-4-toggle.md](./phase-4-toggle.md) | ⬜ pending |
| 5 | [phase-5-frontend.md](./phase-5-frontend.md) | ⬜ pending |
| 6 | [phase-6-tests.md](./phase-6-tests.md) | ⬜ pending |

Виконувати **строго по порядку** — кожна фаза залежить від попередньої.

## Граф залежностей

```
[Phase 1: Types & Env]
        │
        ▼
[Phase 2: Stripe Adapter]
        │
        ▼
[Phase 3: Payments Core]
        │
        ├──► [Phase 4: Toggle Mechanism]
        │
        ▼
[Phase 5: Frontend]
        │
        ▼
[Phase 6: Tests]
```

## Архітектурні рішення

### Два типи платежів

```
PAYMENT_TYPE.SUBSCRIPTION  →  Stripe mode: 'subscription'
                               Оновлює user.billing (підписка)

PAYMENT_TYPE.ONE_OFF        →  Stripe mode: 'payment'
                               Поповнює user.credits.balance
```

### Кредитні пакети (one-off)

Три пакети визначені в `packages/types`:

| packCode      | credits | Stripe Price Env Var              |
|---------------|---------|-----------------------------------|
| `credits_5`   | 5       | `STRIPE_PRICE_CREDITS_5_USD`      |
| `credits_10`  | 10      | `STRIPE_PRICE_CREDITS_10_USD`     |
| `credits_20`  | 20      | `STRIPE_PRICE_CREDITS_20_USD`     |

Кількість кредитів і `packCode` передаються в Stripe metadata → webhook повертає їх назад → `PaymentsService` зараховує кредити.

### Toggle механізм

```
ENV.PAYMENTS_SUBSCRIPTION_ENABLED  (default: true)
ENV.PAYMENTS_ONE_OFF_ENABLED        (default: true)
```

- Startup validation: хоча б один має бути `true`
- Backend: перевірка перед створенням checkout session
- Frontend: `NEXT_PUBLIC_PAYMENTS_*_ENABLED` — умовний рендер UI секцій

### Ключові зміни по модулях

```
packages/types/src/contracts/payments.ts
  + PAYMENT_TYPE enum
  + CREDIT_PACK_CONFIG constant
  + ONE_OFF_PAYMENT_COMPLETED в BILLING_EVENT_TYPE
  + creditsAmount, packCode в BillingWebhookEventSchema (optional)
  + paymentType, packCode в CreateCheckoutSessionSchema
  ~ subscriptionStatus → nullable().optional() в BillingWebhookEventSchema

apps/api/src/config/env.ts
  + PAYMENTS_SUBSCRIPTION_ENABLED
  + PAYMENTS_ONE_OFF_ENABLED
  + STRIPE_PRICE_CREDITS_5_USD
  + STRIPE_PRICE_CREDITS_10_USD
  + STRIPE_PRICE_CREDITS_20_USD
  + STRIPE_CREDIT_PACKS (computed array)

apps/api/src/modules/payments/interfaces/payment-provider.interface.ts
  ~ CreateCheckoutInput: + paymentType, priceId, credits?

apps/api/src/modules/payments/providers/stripe.service.ts
  ~ createCheckoutSession: mode based on paymentType
  ~ handleCheckoutCompleted: check session.mode → ONE_OFF or CHECKOUT_COMPLETED

apps/api/src/modules/payments/payments.service.ts
  ~ createCheckoutSession: + paymentType, feature flag check, priceId resolution
  ~ handleWebhook: skip out-of-order for one-off
  ~ buildBillingUpdate: + ONE_OFF_PAYMENT_COMPLETED case (addCredits)

apps/api/src/modules/users/users.service.ts
  + addCredits(userId, amount)

apps/web/src/shared/api/payments.ts
  ~ createCheckoutSession: передає paymentType + packCode
  + createOneOffCheckoutSession(packCode) helper

apps/web/src/app/[locale]/(protected)/billing/page.tsx
  ~ розділити на SubscriptionSection + CreditsSection
  ~ умовний рендер на основі NEXT_PUBLIC_PAYMENTS_*_ENABLED

apps/web/messages/uk.json + en.json
  + credits_section ключі
```

## Нові env vars (зведена таблиця)

| Var | Required | Default | Опис |
|-----|----------|---------|------|
| `STRIPE_PRICE_CREDITS_5_USD` | якщо ONE_OFF enabled | — | Stripe price ID для 5 кредитів |
| `STRIPE_PRICE_CREDITS_10_USD` | якщо ONE_OFF enabled | — | Stripe price ID для 10 кредитів |
| `STRIPE_PRICE_CREDITS_20_USD` | якщо ONE_OFF enabled | — | Stripe price ID для 20 кредитів |
| `PAYMENTS_SUBSCRIPTION_ENABLED` | ні | `'true'` | Вмикає/вимикає підписку |
| `PAYMENTS_ONE_OFF_ENABLED` | ні | `'true'` | Вмикає/вимикає one-off |
| `NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED` | ні | `'true'` | Frontend toggle для підписки |
| `NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED` | ні | `'true'` | Frontend toggle для one-off |

## Verification після всіх фаз

```bash
pnpm --filter @lucidkit/types build    # types компілюються
pnpm --filter api build                # API компілюється
pnpm --filter web build                # Web компілюється
pnpm lint                              # без помилок
pnpm --filter api test                 # всі unit тести проходять
pnpm --filter api test:e2e             # E2E тести проходять
pnpm --filter web test                 # web тести проходять
```
