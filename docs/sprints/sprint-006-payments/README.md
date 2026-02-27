# Sprint 006 — Payments MVP

Реалізація платіжної підсистеми: Stripe Checkout + Webhook + Subscription billing state. Adapter pattern (`IPaymentProvider`) для майбутнього розширення на інші провайдери.

Специфікація: [`docs/planning/payments-mvp-implementation-blueprint.md`](../../planning/payments-mvp-implementation-blueprint.md)

## Документи

| Файл | Опис |
|---|---|
| [`implementation-plan.md`](./implementation-plan.md) | Повний plan з фазами, залежностями, файлами, верифікацією |
| [`phase-1-foundation.md`](./phase-1-foundation.md) | Types, env vars, DB schemas |
| [`phase-2-stripe-adapter.md`](./phase-2-stripe-adapter.md) | IPaymentProvider + StripeService |
| [`phase-3-payments-core.md`](./phase-3-payments-core.md) | PaymentsService + Controller + webhook handling |
| [`phase-4-access-guard.md`](./phase-4-access-guard.md) | SubscriptionGuard + i18n |
| [`phase-5-frontend.md`](./phase-5-frontend.md) | Billing pages, API client, UI |

## Залежності

- Sprint 004 (auth) — повністю завершений
- Sprint 005 (auth testing) — повністю завершений
- `stripe` npm package — потрібна інсталяція

## Scope

**Входить:**
- `packages/types`: Zod schemas, enums, contracts для payments
- `apps/api`: PaymentsModule (controller, service, StripeService, webhook, guard, schemas)
- `apps/web`: billing page skeleton, checkout flow, subscription status

**Не входить:**
- Monobank або інші провайдери (тільки adapter interface)
- Dunning/tax логіка
- Subscription upgrade/downgrade (тільки один plan `monthly_usd`)
- Повноцінний billing dashboard (тільки MVP)
- Unit/E2E тести (окремий sprint)

## Порядок виконання

```
Phase 1 (Foundation)
    ├── Phase 2 (Stripe Adapter) — залежить від Phase 1
    │       └── Phase 3 (Payments Core) — залежить від Phase 1 + Phase 2
    │               └── Phase 4 (Access Guard) — залежить від Phase 3
    │                       └── Phase 5 (Frontend) — залежить від Phase 3 + Phase 4
```

Всі фази послідовні. Кожна наступна залежить від попередньої.

## Verification

1. `pnpm --filter @lucidkit/types build` — types збираються без помилок
2. `pnpm --filter api build` — API збирається
3. `pnpm --filter web build` — Web збирається
4. `pnpm lint` — без помилок
5. `pnpm --filter api test` — існуючі тести не зламані
6. `pnpm --filter web test` — існуючі тести не зламані
