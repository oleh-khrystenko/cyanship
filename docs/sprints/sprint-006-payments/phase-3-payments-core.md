# Phase 3 — Payments Core

> Залежить від: Phase 1 (Foundation) + Phase 2 (Stripe Adapter).
> Перед початком прочитай:
> - `docs/planning/payments-mvp-implementation-blueprint.md` — секції 4, 5, 6, 7
> - `apps/api/src/modules/payments/` — skeleton + Phase 2 файли
> - `apps/api/src/modules/auth/auth.controller.ts` — патерн controller endpoints
> - `apps/api/src/modules/auth/auth.service.ts` — патерн service orchestration
> - `apps/api/src/main.ts` — bootstrap (для raw body)
> - `apps/api/src/modules/users/users.service.ts` — патерн UsersService

## Мета

Реалізувати `PaymentsService` (orchestration + billing state), `PaymentsController` (3 endpoints), raw body handling, DTO, і webhook idempotency flow. Після цієї фази весь backend payments flow працює end-to-end.

## Constraints

1. **API response format:** `{ data: { ... } }` для success, `{ error: { code, message } }` для errors.
2. **API message responses:** `{ data: { code: ResponseCode, message: string } }` — використовуй `RESPONSE_CODE`.
3. **Raw body:** `NestFactory.create(AppModule, { rawBody: true })`. Отримання через `req.rawBody`.
4. **Webhook route — без JWT auth, без ThrottlerGuard.** Тільки provider signature verification.
5. **Idempotency:** `processed_webhook_events` unique index як primary dedup mechanism.
6. **Out-of-order:** `occurredAt <= lastProviderEventAt` → skip.
7. **DTOs через `createZodDto()` з `nestjs-zod`.** Схеми з `@lucidkit/types`.

## Крок 1: Raw body в bootstrap

**Файл:** `apps/api/src/main.ts` — **EDIT**

Змінити `NestFactory.create`:

```typescript
// Було:
const app = await NestFactory.create(AppModule);

// Стало:
const app = await NestFactory.create(AppModule, { rawBody: true });
```

> **Чому:** Stripe SDK вимагає необроблений Buffer для `stripe.webhooks.constructEvent()`. Стандартний Express JSON body-parser парсить body до JavaScript object, що ламає signature verification. `rawBody: true` зберігає оригінальний Buffer в `req.rawBody`.

## Крок 2: DTO

**Файл:** `apps/api/src/modules/payments/dto/create-checkout-session.dto.ts` — **NEW**

```typescript
import { createZodDto } from 'nestjs-zod';
import { CreateCheckoutSessionSchema } from '@lucidkit/types';

export class CreateCheckoutSessionDto extends createZodDto(
    CreateCheckoutSessionSchema,
) {}
```

## Крок 3: PaymentsService

**Файл:** `apps/api/src/modules/payments/payments.service.ts` — **EDIT** (замінити skeleton)

### Dependencies (constructor injection)

```typescript
@Inject(PAYMENT_PROVIDER)
private readonly paymentProvider: IPaymentProvider,

@InjectModel(User.name)
private readonly userModel: Model<UserDocument>,

@InjectModel(ProcessedWebhookEvent.name)
private readonly webhookEventModel: Model<ProcessedWebhookEventDocument>,
```

### `createCheckoutSession(userId: string, planCode: string)`

1. Знайти user по `userId`.
2. Якщо `user.billing?.hasActiveSubscription === true` → throw `ConflictException` з message `Already subscribed`.
3. Викликати `paymentProvider.createCheckoutSession()` з:
   - `userId`, `userEmail: user.email`, `planCode`
   - `successUrl: ENV.BILLING_SUCCESS_URL`, `cancelUrl: ENV.BILLING_CANCEL_URL`
4. Повернути `{ checkoutUrl }`.

### `createPortalSession(userId: string)`

1. Знайти user по `userId`.
2. Якщо `!user.billing?.providerCustomerId` → throw `BadRequestException` з message відповідно до `NO_BILLING_ACCOUNT`.
3. Викликати `paymentProvider.createPortalSession(user.billing.providerCustomerId)`.
4. Повернути `{ portalUrl }`.

### `handleWebhook(provider: string, rawBody: Buffer, signatureHeader: string)`

Повний idempotency flow:

```
1. paymentProvider.handleWebhookPayload(rawBody, signatureHeader)
   → null? return (unknown event type, 200)

2. Resolve userId:
   - Якщо event.userId не пустий → використовувати
   - Якщо пустий → шукати user по providerSubscriptionId з event.raw
     (raw.data.object.id для subscription events)
   - Не знайдено → log warning, return

3. Insert в processed_webhook_events:
   { provider, providerEventId, receivedAt: new Date(), occurredAt, type, userId }
   → duplicate key error? return (already processed, 200)

4. Знайти user по userId.
   Якщо !user → log warning, return.

5. Out-of-order check:
   Якщо user.billing?.lastProviderEventAt &&
        event.occurredAt <= user.billing.lastProviderEventAt
   → return (stale event, 200)

6. Apply billing state update (switch by event.type):
   - CHECKOUT_COMPLETED → витягти з raw: providerCustomerId, providerSubscriptionId, planCode, currency. Upsert user.billing з усіма полями.
   - SUBSCRIPTION_UPDATED → оновити subscriptionStatus, providerSubscriptionStatus, currentPeriodEnd, cancelAtPeriodEnd.
   - SUBSCRIPTION_DELETED → status = CANCELED, hasActiveSubscription = false.

7. Для всіх типів:
   - hasActiveSubscription = status in [ACTIVE, TRIALING]
   - lastProviderEventAt = event.occurredAt

8. Save user (atomic update через findByIdAndUpdate).

9. Log success.
```

> **Atomic update:** Використовувати `findByIdAndUpdate` з `$set` для billing fields — не load-modify-save pattern. Це запобігає race conditions при concurrent webhook events.

## Крок 4: PaymentsController

**Файл:** `apps/api/src/modules/payments/payments.controller.ts` — **EDIT** (замінити skeleton)

### `POST /checkout-session` (JWT protected)

```typescript
@UseGuards(JwtAuthGuard)
@Post('checkout-session')
async createCheckoutSession(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateCheckoutSessionDto,
): Promise<{ data: { checkoutUrl: string } }> {
    const result = await this.paymentsService.createCheckoutSession(
        user._id.toString(),
        dto.planCode,
    );
    return { data: { checkoutUrl: result.checkoutUrl } };
}
```

### `POST /portal-session` (JWT protected)

```typescript
@UseGuards(JwtAuthGuard)
@Post('portal-session')
async createPortalSession(
    @CurrentUser() user: UserDocument,
): Promise<{ data: { portalUrl: string } }> {
    const result = await this.paymentsService.createPortalSession(
        user._id.toString(),
    );
    return { data: { portalUrl: result.portalUrl } };
}
```

### `POST /webhook/:provider` (NO auth, NO throttle)

```typescript
@SkipThrottle()
@Post('webhook/:provider')
async handleWebhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
): Promise<{ received: true }> {
    const rawBody = req.rawBody;
    if (!rawBody) {
        throw new BadRequestException('Missing raw body');
    }
    await this.paymentsService.handleWebhook(provider, rawBody, signature);
    return { received: true };
}
```

> **`@SkipThrottle()`:** Webhook endpoint не повинен мати rate limiting — Stripe retry механізм потребує стабільного доступу. `SkipThrottle` з `@nestjs/throttler`.

> **`RawBodyRequest<Request>`:** NestJS type що додає `rawBody?: Buffer` до стандартного Request.

> **Response `{ received: true }`:** Stripe очікує 2xx status. Повертаємо мінімальний response без `{ data: ... }` wrapper — це не user-facing endpoint.

## Крок 5: PaymentsModule wiring

**Файл:** `apps/api/src/modules/payments/payments.module.ts` — **EDIT**

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { paymentProviderProvider } from './providers/payment-provider.provider';
import { StripeService } from './providers/stripe.service';
import {
    ProcessedWebhookEvent,
    ProcessedWebhookEventSchema,
} from './schemas/processed-webhook-event.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ProcessedWebhookEvent.name, schema: ProcessedWebhookEventSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [PaymentsController],
    providers: [PaymentsService, StripeService, paymentProviderProvider],
    exports: [PaymentsService],
})
export class PaymentsModule {}
```

> **Примітка:** `User` schema імпортується через `MongooseModule.forFeature` — це дозволяє `PaymentsService` оновлювати billing state напряму без залежності від `UsersModule`. Це уникає circular dependency (як AuthModule ↔ UsersModule).

## Порядок виконання

```
1. Крок 1 — main.ts raw body (EDIT)
2. Крок 2 — DTO (NEW)
3. Крок 3 — PaymentsService (EDIT)
4. Крок 4 — PaymentsController (EDIT)
5. Крок 5 — PaymentsModule wiring (EDIT)
6. pnpm --filter api build — перевірити компіляцію
```

## Verification

1. `pnpm --filter api build` — без помилок
2. `pnpm lint` — без помилок
3. `pnpm --filter api test` — існуючі тести проходять (raw body зміна не ламає їх)
4. Controller має рівно 3 endpoints: `checkout-session`, `portal-session`, `webhook/:provider`
5. Webhook endpoint не має `JwtAuthGuard` і має `@SkipThrottle()`
6. `PaymentsService` інжектує `PAYMENT_PROVIDER` token, не `StripeService` напряму
7. Жоден файл поза `providers/stripe.service.ts` не імпортує `stripe` SDK
