# Phase 4 — Access Guard

> Залежить від: Phase 3 (Payments Core).
> Перед початком прочитай:
> - `apps/api/src/common/guards/jwt-auth.guard.ts` — патерн existing guard
> - `apps/api/src/common/decorators/current-user.decorator.ts` — патерн decorator
> - `apps/api/src/common/filters/all-exceptions.filter.ts` — як обробляються HTTP exceptions
> - `packages/types/src/enums/response-code.ts` — RESPONSE_CODE (з Phase 1 змінами)

## Мета

Створити `SubscriptionGuard` що перевіряє `user.billing.hasActiveSubscription`. Після цієї фази будь-який endpoint можна захистити через `@UseGuards(JwtAuthGuard, SubscriptionGuard)`.

## Constraints

1. **SubscriptionGuard завжди використовується ПІСЛЯ JwtAuthGuard.** Guard потребує `request.user` який заповнює JWT strategy.
2. **403 Forbidden** з `RESPONSE_CODE.SUBSCRIPTION_REQUIRED` — не 401.
3. **Guard НЕ робить DB query.** Він читає `request.user` який вже завантажений JWT strategy (includes billing field).

## Крок 1: SubscriptionGuard

**Файл:** `apps/api/src/common/guards/subscription.guard.ts` — **NEW**

```typescript
import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { UserDocument } from '../../modules/users/schemas/user.schema';

@Injectable()
export class SubscriptionGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const user = request.user as UserDocument | undefined;

        if (!user) {
            throw new ForbiddenException('Subscription required');
        }

        if (!user.billing?.hasActiveSubscription) {
            throw new ForbiddenException('Subscription required');
        }

        return true;
    }
}
```

> **Примітка:** `ForbiddenException` (403) замість `UnauthorizedException` (401). 401 зарезервовано для "не авторизований" (немає JWT). 403 — "авторизований, але немає доступу" (немає підписки). `AllExceptionsFilter` обробить це як `{ error: { code: 'SUBSCRIPTION_REQUIRED', message: '...' } }`.

## Крок 2: AllExceptionsFilter — маппінг 403

**Файл:** `apps/api/src/common/filters/all-exceptions.filter.ts` — **EDIT**

Перевірити що 403 маппиться коректно. Якщо немає — додати:

```typescript
// В mapping:
403: 'SUBSCRIPTION_REQUIRED',
```

> **Примітка:** Якщо filter використовує generic mapping без 403 — додати. Якщо вже є — перевірити що message з exception пропагується.

## Крок 3: Використання (приклад)

Guard готовий для використання в будь-якому controller:

```typescript
// Приклад в майбутньому ReportsController:
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Post()
async createReport(@CurrentUser() user: UserDocument) {
    // ...
}
```

В поточному MVP цей guard **не застосовується** до жодного endpoint — Reports/Storage ще skeleton. Guard створюється зараз щоб був готовий.

## Крок 4: i18n ключі

**Файл:** `apps/web/messages/uk.json` — **EDIT**

Додати в відповідні секції:

```json
{
    "notifications": {
        "payments": {
            "CHECKOUT_SESSION_CREATED": "Сесію оплати створено. Переходьте до оплати.",
            "PORTAL_SESSION_CREATED": "Перенаправлення до порталу керування підпискою.",
            "WEBHOOK_PROCESSED": "Webhook оброблено."
        }
    },
    "errors": {
        "payments": {
            "ALREADY_SUBSCRIBED": "У вас вже є активна підписка.",
            "SUBSCRIPTION_REQUIRED": "Для доступу потрібна активна підписка.",
            "NO_BILLING_ACCOUNT": "Платіжний акаунт не знайдено. Оформіть підписку."
        }
    }
}
```

**Файл:** `apps/web/messages/en.json` — **EDIT**

```json
{
    "notifications": {
        "payments": {
            "CHECKOUT_SESSION_CREATED": "Checkout session created. Proceed to payment.",
            "PORTAL_SESSION_CREATED": "Redirecting to subscription management portal.",
            "WEBHOOK_PROCESSED": "Webhook processed."
        }
    },
    "errors": {
        "payments": {
            "ALREADY_SUBSCRIBED": "You already have an active subscription.",
            "SUBSCRIPTION_REQUIRED": "An active subscription is required for access.",
            "NO_BILLING_ACCOUNT": "No billing account found. Please subscribe first."
        }
    }
}
```

> **Tone convention:** Формальне "ви", без емодзі, 1-2 речення. Success — минулий час або інструкція. Errors — констатація + що робити.

## Крок 5: mapApiCode.ts

**Файл:** `apps/web/src/shared/api/mapApiCode.ts` — **EDIT**

Перевірити що `getApiMessageKey` вже підтримує `payments` module. Якщо mapping hardcoded — додати payments коди. Якщо dynamic (через i18n key pattern) — перевірити що `notifications.payments.{code}` та `errors.payments.{code}` резолвляться коректно.

## Порядок виконання

```
1. Крок 1 — SubscriptionGuard (NEW)
2. Крок 2 — AllExceptionsFilter 403 mapping (EDIT, якщо потрібно)
3. Крок 4 — i18n keys uk.json + en.json (EDIT)
4. Крок 5 — mapApiCode.ts (EDIT, якщо потрібно)
5. pnpm --filter api build && pnpm --filter web build
```

## Verification

1. `pnpm --filter api build` — без помилок
2. `pnpm --filter web build` — без помилок (i18n keys валідні)
3. `pnpm lint` — без помилок
4. `pnpm --filter api test` — існуючі тести проходять
5. `pnpm --filter web test` — існуючі тести проходять
6. `SubscriptionGuard` не імпортує жодного payments-specific модуля — тільки User schema type
7. i18n ключі присутні в обох мовних файлах (uk + en)
