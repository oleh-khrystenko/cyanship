# Phase 3 — Payments Core

## Залежності

Вимагає завершення Phase 1 + Phase 2.

## Scope

- `apps/api/src/modules/users/users.service.ts` — додати `addCredits()`
- `apps/api/src/modules/payments/payments.service.ts` — оновити логіку checkout + webhook
- `apps/api/src/modules/payments/payments.controller.ts` — оновити DTO прийом

---

## 3.1 `users.service.ts` — додати `addCredits()`

**Читай поточний файл перед змінами.**

Додати новий метод після `deductCredit`:

```typescript
async addCredits(userId: string, amount: number): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
        $inc: { 'credits.balance': amount },
    });
}
```

Використовує MongoDB `$inc` для атомарного збільшення балансу. Якщо `userId` не існує — операція мовчки ігнорується (не кидає помилку).

---

## 3.2 `payments.service.ts`

**Читай поточний файл перед змінами (259 рядків).**

### 3.2.1 Import оновлення

```typescript
import {
    BILLING_EVENT_TYPE,
    PAYMENT_TYPE,
    RESPONSE_CODE,
    SUBSCRIPTION_STATUS,
    type BillingWebhookEvent,
} from '@lucidship/types';
import { ENV, STRIPE_CREDIT_PACKS } from '../../config/env';
```

Додати `UsersService` у constructor (для `addCredits`):

```typescript
import { UsersService } from '../users/users.service';
```

### 3.2.2 Constructor — inject UsersService

```typescript
constructor(
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: IPaymentProvider,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @InjectModel(ProcessedWebhookEvent.name)
    private readonly webhookEventModel: Model<ProcessedWebhookEventDocument>,

    private readonly usersService: UsersService,  // NEW
) {}
```

**Увага:** `UsersService` вже re-exported з `UsersModule`. Перевір що `PaymentsModule` вже імпортує `UsersModule` — так, в `payments.module.ts` є `imports: [UsersModule, ...]`.

### 3.2.3 `createCheckoutSession` — повна заміна

Поточна сигнатура: `createCheckoutSession(userId: string, planCode: string)`
Нова сигнатура: `createCheckoutSession(userId: string, dto: CreateCheckoutSession)`

```typescript
import { type CreateCheckoutSession } from '@lucidship/types';

async createCheckoutSession(
    userId: string,
    dto: CreateCheckoutSession,
): Promise<{ checkoutUrl: string }> {
    const { paymentType, planCode, packCode } = dto;

    // Feature flag check
    if (
        paymentType === PAYMENT_TYPE.SUBSCRIPTION &&
        !ENV.PAYMENTS_SUBSCRIPTION_ENABLED
    ) {
        throw new BadRequestException({
            code: RESPONSE_CODE.PAYMENT_TYPE_DISABLED,
            message: 'Subscription payments are disabled',
        });
    }
    if (
        paymentType === PAYMENT_TYPE.ONE_OFF &&
        !ENV.PAYMENTS_ONE_OFF_ENABLED
    ) {
        throw new BadRequestException({
            code: RESPONSE_CODE.PAYMENT_TYPE_DISABLED,
            message: 'One-off payments are disabled',
        });
    }

    const user = await this.userModel.findById(userId).lean();
    if (!user) {
        throw new BadRequestException('User not found');
    }

    // Subscription-specific validation
    if (paymentType === PAYMENT_TYPE.SUBSCRIPTION) {
        if (user.billing?.hasActiveSubscription) {
            throw new ConflictException({
                code: RESPONSE_CODE.ALREADY_SUBSCRIBED,
                message: 'Already subscribed',
            });
        }
        const priceId = ENV.STRIPE_PRICE_MONTHLY_USD;
        const result = await this.paymentProvider.createCheckoutSession({
            userId,
            userEmail: user.email,
            paymentType,
            planCode: planCode!,
            priceId,
            successUrl: ENV.BILLING_SUCCESS_URL,
            cancelUrl: ENV.BILLING_CANCEL_URL,
        });
        return { checkoutUrl: result.checkoutUrl };
    }

    // One-off payment
    const pack = packCode ? STRIPE_CREDIT_PACKS[packCode] : undefined;
    if (!pack) {
        throw new BadRequestException('Invalid packCode');
    }
    const result = await this.paymentProvider.createCheckoutSession({
        userId,
        userEmail: user.email,
        paymentType,
        planCode: packCode!,
        priceId: pack.priceId,
        credits: pack.credits,
        successUrl: ENV.BILLING_SUCCESS_URL,
        cancelUrl: ENV.BILLING_CANCEL_URL,
    });
    return { checkoutUrl: result.checkoutUrl };
}
```

### 3.2.4 `handleWebhook` — оновлення out-of-order check і застосування one-off

Змінити крок 5 (out-of-order check) — виключити `ONE_OFF_PAYMENT_COMPLETED`:

```typescript
// 5. Out-of-order check (тільки для subscription events)
// One-off платежі незалежні один від одного, order не важливий
if (
    event.type !== BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED &&
    user.billing?.lastProviderEventAt &&
    event.occurredAt < user.billing.lastProviderEventAt
) {
    this.logger.debug(
        `Skipping stale event ${event.providerEventId} for user ${userId}`,
    );
    return;
}
```

Замінити крок 6-8 — розрізнити subscription vs one-off:

```typescript
// 6. Apply event
if (event.type === BILLING_EVENT_TYPE.ONE_OFF_PAYMENT_COMPLETED) {
    await this.applyOneOffPayment(userId, event);
} else {
    const billingFields = this.buildBillingUpdate(event, user);
    const existingBilling = (user.billing ?? {}) as Record<string, unknown>;
    await this.userModel.findByIdAndUpdate(userId, {
        $set: { billing: { ...existingBilling, ...billingFields } },
    });
}

this.logger.log(
    `Processed ${event.type} for user ${userId} (event: ${event.providerEventId})`,
);
```

### 3.2.5 Новий private метод `applyOneOffPayment`

Додати після `buildBillingUpdate`:

```typescript
private async applyOneOffPayment(
    userId: string,
    event: BillingWebhookEvent,
): Promise<void> {
    const credits = event.creditsAmount ?? 0;
    if (credits <= 0) {
        this.logger.warn(
            `ONE_OFF_PAYMENT_COMPLETED event ${event.providerEventId} has no creditsAmount`,
        );
        return;
    }
    await this.usersService.addCredits(userId, credits);
    this.logger.log(
        `Added ${credits} credits to user ${userId} (event: ${event.providerEventId})`,
    );
}
```

### 3.2.6 `buildBillingUpdate` — TypeScript fix

Після оновлення `BillingWebhookEventSchema` поля `subscriptionStatus`, `cancelAtPeriodEnd` стали optional. Оновити switch:

```typescript
private buildBillingUpdate(
    event: BillingWebhookEvent,
    user: User & { _id: unknown },
): Record<string, unknown> {
    // subscriptionStatus тепер optional — fallback до UNKNOWN для безпеки
    const status = event.subscriptionStatus ?? SUBSCRIPTION_STATUS.UNKNOWN;
    const hasActive =
        status === SUBSCRIPTION_STATUS.ACTIVE ||
        status === SUBSCRIPTION_STATUS.TRIALING;

    const fields: Record<string, unknown> = {
        subscriptionStatus: status,
        hasActiveSubscription: hasActive,
        lastProviderEventAt: event.occurredAt,
        cancelAtPeriodEnd: event.cancelAtPeriodEnd ?? false,
    };

    if (event.currentPeriodEnd) {
        fields['currentPeriodEnd'] = event.currentPeriodEnd;
    }

    switch (event.type) {
        case BILLING_EVENT_TYPE.CHECKOUT_COMPLETED: {
            // ... (без змін)
        }
        case BILLING_EVENT_TYPE.SUBSCRIPTION_UPDATED: {
            // ... (без змін)
        }
        case BILLING_EVENT_TYPE.SUBSCRIPTION_DELETED: {
            // ... (без змін)
        }
        // ONE_OFF_PAYMENT_COMPLETED НЕ потрапляє сюди — обробляється в applyOneOffPayment
    }

    return fields;
}
```

---

## 3.3 `payments.controller.ts`

**Читай поточний файл перед змінами.**

### `createCheckoutSession` endpoint

Поточний код передає `dto.planCode` в сервіс. Тепер потрібно передавати весь `dto`:

```typescript
@Post('checkout-session')
@UseGuards(JwtAuthGuard)
async createCheckoutSession(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateCheckoutSessionDto,
): Promise<{ data: { checkoutUrl: string } }> {
    const { checkoutUrl } = await this.paymentsService.createCheckoutSession(
        user._id.toString(),
        dto,  // передаємо весь DTO замість dto.planCode
    );
    return { data: { checkoutUrl } };
}
```

---

## Verification Phase 3

```bash
pnpm --filter api build
# Перевірити TypeScript errors
```

Ручна перевірка:
- `PaymentsService.createCheckoutSession` приймає `CreateCheckoutSession` DTO
- `UsersService.addCredits` існує і правильно робить `$inc`
- `handleWebhook` перевіряє `event.type !== ONE_OFF_PAYMENT_COMPLETED` перед out-of-order skip
- `applyOneOffPayment` логує і кидає warn якщо `creditsAmount <= 0`
- `buildBillingUpdate` не впаде на `event.subscriptionStatus === undefined`
