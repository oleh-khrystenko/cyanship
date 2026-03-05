# Payments MVP — Implementation Plan

## Огляд

5 фаз: foundation (types + DB) → Stripe adapter → payments core (service + controller + webhook) → access guard → frontend. Adapter pattern через NestJS DI injection token, без Registry class.

## Фази

| # | Фаза | Scope | Залежить від |
|---|------|-------|--------------|
| 1 | Foundation | `packages/types` contracts, env vars, User billing schema, ProcessedWebhookEvent schema | — |
| 2 | Stripe Adapter | `IPaymentProvider` interface, `StripeService`, DI token, `stripe` npm install | Phase 1 |
| 3 | Payments Core | `PaymentsService`, `PaymentsController`, raw body setup, webhook flow, idempotency | Phase 1 + 2 |
| 4 | Access Guard | `SubscriptionGuard`, `@RequireSubscription()`, response codes, i18n | Phase 3 |
| 5 | Frontend | Billing page, checkout flow, subscription status, portal link | Phase 3 + 4 |

## Граф залежностей

```
[Phase 1: Foundation]
       │
       ▼
[Phase 2: Stripe Adapter]
       │
       ▼
[Phase 3: Payments Core]
       │
       ▼
[Phase 4: Access Guard]
       │
       ▼
[Phase 5: Frontend]
```

## Нові файли

### `packages/types/src/`

```
contracts/payments.ts                    — NEW: Zod schemas + enums + types
entities/user.ts                         — EDIT: додати UserBillingSchema
enums/response-code.ts                   — EDIT: нові RESPONSE_CODE
index.ts                                 — EDIT: re-export contracts/payments
```

### `apps/api/src/`

```
config/env.ts                            — EDIT: Stripe env vars
main.ts                                  — EDIT: rawBody: true
modules/payments/
  interfaces/payment-provider.interface.ts — NEW: IPaymentProvider
  providers/
    payment-provider.provider.ts          — NEW: DI token + factory
    stripe.service.ts                     — NEW: StripeService implements IPaymentProvider
  schemas/
    processed-webhook-event.schema.ts     — NEW: Mongoose schema
  dto/
    create-checkout-session.dto.ts        — NEW: createZodDto
  payments.module.ts                      — EDIT: wire all providers
  payments.controller.ts                  — EDIT: 3 endpoints
  payments.service.ts                     — EDIT: orchestration + billing state
modules/users/
  schemas/user.schema.ts                  — EDIT: billing subdocument
common/
  guards/subscription.guard.ts            — NEW: SubscriptionGuard
  decorators/require-subscription.decorator.ts — NEW (optional, якщо guard + decorator pattern)
```

### `apps/web/src/`

```
shared/api/payments.ts                   — NEW: API client functions
app/[locale]/(protected)/billing/
  page.tsx                                — NEW: billing page
messages/uk.json                         — EDIT: payments i18n keys
messages/en.json                         — EDIT: payments i18n keys
middleware.ts                            — EDIT: додати /billing до protected paths
```

## Verification

1. `pnpm --filter @lucidship/types build` — types збираються
2. `pnpm --filter api build` — API збирається
3. `pnpm --filter web build` — Web збирається
4. `pnpm lint` — без помилок
5. `pnpm --filter api test` — існуючі тести проходять
6. `pnpm --filter web test` — існуючі тести проходять
