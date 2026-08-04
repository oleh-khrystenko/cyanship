# Feature Flags

## Два незалежних toggle

Файл: `packages/types/src/constants/payments.ts`

| Flag | Константа | Default |
|------|-----------|---------|
| Subscriptions | `PAYMENTS_SUBSCRIPTION_ENABLED` | `true` |
| One-off (execution packs) | `PAYMENTS_ONE_OFF_ENABLED` | `true` |

Це не env vars: одна константа читається і backend'ом, і frontend'ом, тому розсинхрон між тим, що показує сайт, і тим, що дозволяє API, неможливий. Форк, який продає лише один тип оплати, змінює значення тут.

Обидві оголошені з анотацією `: boolean` навмисно — з літеральним типом TypeScript вважав би вимкнену гілку недосяжною і не перевіряв би код, який її обробляє.

## Правило

Хоча б один тип платежу повинен бути увімкнений. Перевірка при старті API — `CatalogService.onModuleInit()`:

```typescript
if (!PAYMENTS_SUBSCRIPTION_ENABLED && !PAYMENTS_ONE_OFF_ENABLED) {
    throw new Error('At least one payment type must be enabled');
}
```

## Backend поведінка

Файл: `apps/api/src/modules/payments/payments.service.ts`

- Якщо `paymentType: 'subscription'` і `PAYMENTS_SUBSCRIPTION_ENABLED === false` → 400 `PAYMENT_TYPE_DISABLED`
- Якщо `paymentType: 'one_off'` і `PAYMENTS_ONE_OFF_ENABLED === false` → 400 `PAYMENT_TYPE_DISABLED`

`GET /payments/catalog` (`payments.controller.ts`) віддає порожній масив для вимкненого типу, а `CatalogService.validateCatalog()` не вимагає наявності відповідних Stripe Products.

## Frontend поведінка

- `PAYMENTS_SUBSCRIPTION_ENABLED` контролює видимість секції підписки на billing page
- `PAYMENTS_ONE_OFF_ENABLED` контролює видимість секції пакетів на billing page
- Секції повністю не рендеряться якщо flag = false
- Споживачі: `app/[locale]/(protected)/billing/page.tsx`, `app/[locale]/(protected)/dashboard/page.tsx`, `features/agency/proof/ui/ProofBilling`
