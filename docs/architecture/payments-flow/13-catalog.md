# Каталог — Stripe як єдине джерело правди

Файл: `apps/api/src/modules/payments/catalog.service.ts`

## Ідея

Ціни, кількість executions, порядок відображення і featured-позначка **не зберігаються в коді і не є env vars**. Вони живуть у metadata Stripe Products, а `CatalogService` читає їх звідти й кешує в Redis. Змінити ціну = змінити її у Stripe Dashboard; редеплой не потрібен.

У коді залишаються тільки коди планів і пакетів (`SUBSCRIPTION_PLAN_CODES`, `EXECUTION_PACK_CODES` у `packages/types/src/contracts/payments.ts`) — вони потрібні як i18n-ключі, імена зображень і значення в БД.

## Metadata Stripe Product

| Ключ | Обов'язковий | Значення |
|------|--------------|----------|
| `code` | так | `starter` \| `pro` \| `basic` \| `max` |
| `purchase_type` | так | `subscription` \| `executions_pack` |
| `executions` | ні (default `0`) | Скільки executions дає покупка |
| `display_order` | ні (default `0`) | Порядок сортування за зростанням |
| `featured` | ні (default `false`) | Рядок `'true'` вмикає виділення в UI |

Ціна береться з `default_price` продукту (`unit_amount`, `currency`, для підписок — `recurring.interval`).

Продукти без `code` або `purchase_type` тихо пропускаються — це не помилка, у Stripe-акаунті можуть бути інші продукти. Продукт з `code`, але без `default_price` з `unit_amount`, пропускається з `logger.warn`; невідомий `purchase_type` — так само.

## Кеш

- Redis ключ: `payments:catalog`, TTL 300 секунд
- `getCatalog()` читає з кешу; при промаху або помилці Redis іде напряму в Stripe (Redis-збій — не фатальний, лише `logger.warn`)
- `refreshCatalog()` примусово читає зі Stripe і перезаписує кеш

## Старт застосунку (fail-fast)

`onModuleInit()`:

1. Перевіряє, що хоча б один тип оплати увімкнений (`09-feature-flags.md`) — інакше кидає помилку
2. `refreshCatalog()` — прогріває кеш; Stripe недоступний на старті = падіння API
3. `validateCatalog()` — перевіряє, що для кожного увімкненого типу присутні всі очікувані коди і що коди не дублюються

Валідація ловить друкарську помилку в metadata на деплої, а не в момент, коли юзер натисне «Купити». Для вимкненого типу оплати відповідні продукти не вимагаються.

## Власний Stripe SDK інстанс

`CatalogService` створює свій `new Stripe(ENV.STRIPE_SECRET_KEY)` замість того, щоб ходити через `IPaymentProvider`. Причина — циклічна залежність: `StripeService` сам потребує каталог для мапінгу `priceId → planCode`. Обидва інстанси працюють з тим самим ключем.

## Споживачі

| Хто | Що бере |
|-----|---------|
| `PaymentsController.getCatalog()` | Публічний `GET /payments/catalog` — без auth, з урахуванням feature flags |
| `PaymentsService.createCheckoutSession()` | `priceId` і `executions` за `planCode` / `packCode` |
| `PaymentsService` (webhooks) | `getPriceToPlanMap()`, `getPriceToExecutionsMap()` — зворотній пошук для proration при зміні плану |
