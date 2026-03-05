# Phase 5 — Frontend

## Залежності

Вимагає завершення Phase 1 + Phase 3 + Phase 4.

## Scope

- `apps/web/src/shared/api/payments.ts`
- `apps/web/src/app/[locale]/(protected)/billing/page.tsx`
- `apps/web/messages/uk.json`
- `apps/web/messages/en.json`

---

## 5.1 `apps/web/src/shared/api/payments.ts`

**Читай поточний файл перед змінами.**

Поточний `createCheckoutSession(planCode: string)` потребує оновлення — тепер відправляє `paymentType` і відповідно `planCode` або `packCode`.

### Нова версія файлу:

```typescript
import client from './client';
import { PAYMENT_TYPE, type CreditPackCode } from '@lucidship/types';

export const createSubscriptionCheckout = async (
    planCode: string,
): Promise<{ checkoutUrl: string }> => {
    const response = await client.post<{ data: { checkoutUrl: string } }>(
        '/api/payments/checkout-session',
        { paymentType: PAYMENT_TYPE.SUBSCRIPTION, planCode },
    );
    return response.data.data;
};

export const createOneOffCheckout = async (
    packCode: CreditPackCode,
): Promise<{ checkoutUrl: string }> => {
    const response = await client.post<{ data: { checkoutUrl: string } }>(
        '/api/payments/checkout-session',
        { paymentType: PAYMENT_TYPE.ONE_OFF, packCode },
    );
    return response.data.data;
};

export const createPortalSession = async (): Promise<{ portalUrl: string }> => {
    const response = await client.post<{ data: { portalUrl: string } }>(
        '/api/payments/portal-session',
    );
    return response.data.data;
};
```

**Примітка:** Стару функцію `createCheckoutSession` прибрати або замінити на `createSubscriptionCheckout`. Оновити всі імпорти в `billing/page.tsx`.

---

## 5.2 `apps/web/src/app/[locale]/(protected)/billing/page.tsx`

**Читай поточний файл перед змінами (131 рядок).**

### Логіка UI

Billing page тепер має 3 можливі стани видимості:

| `PAYMENTS_SUBSCRIPTION_ENABLED` | `PAYMENTS_ONE_OFF_ENABLED` | Що показати |
|--------------------------------|---------------------------|-------------|
| true | true | Обидві секції: підписка + кредити |
| true | false | Тільки секція підписки |
| false | true | Тільки секція кредитів |

Кожна секція незалежна.

### Структура сторінки:

```tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useState } from 'react';
import {
    PAYMENTS_SUBSCRIPTION_ENABLED,
    PAYMENTS_ONE_OFF_ENABLED,
} from '@/shared/config/env';
import {
    createSubscriptionCheckout,
    createOneOffCheckout,
    createPortalSession,
} from '@/shared/api/payments';
import { useAuthStore } from '@/stores/auth';
import { CREDIT_PACK_CONFIG, type CreditPackCode } from '@lucidship/types';
import UiButton from '@/shared/ui/UiButton';
import UiSpinner from '@/shared/ui/UiSpinner';

export default function BillingPage() {
    const t = useTranslations('billing_page');
    const locale = useLocale();
    const user = useAuthStore((s) => s.user);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    if (!user) return null;

    const billing = user.billing;
    const hasActive = billing?.hasActiveSubscription === true;

    const formatDate = (date: Date | string | null) => {
        if (!date) return '';
        return new Intl.DateTimeFormat(
            locale === 'uk' ? 'uk-UA' : 'en-US',
            { year: 'numeric', month: 'long', day: 'numeric' },
        ).format(date instanceof Date ? date : new Date(date));
    };

    const handleSubscriptionCheckout = async () => {
        setLoadingAction('subscribe');
        try {
            const { checkoutUrl } = await createSubscriptionCheckout('monthly_usd');
            window.location.href = checkoutUrl;
        } catch {
            toast.error(t('subscribe.error'));
            setLoadingAction(null);
        }
    };

    const handleOneOffCheckout = async (packCode: CreditPackCode) => {
        setLoadingAction(`oneoff_${packCode}`);
        try {
            const { checkoutUrl } = await createOneOffCheckout(packCode);
            window.location.href = checkoutUrl;
        } catch {
            toast.error(t('credits.error'));
            setLoadingAction(null);
        }
    };

    const handlePortal = async () => {
        setLoadingAction('portal');
        try {
            const { portalUrl } = await createPortalSession();
            window.location.href = portalUrl;
        } catch {
            toast.error(t('active.manage_error'));
            setLoadingAction(null);
        }
    };

    return (
        <div className="mx-auto max-w-lg space-y-12 px-4 py-12">

            {/* ── Subscription Section ── */}
            {PAYMENTS_SUBSCRIPTION_ENABLED && (
                <section>
                    {!hasActive ? (
                        <>
                            <h2 className="text-text-primary mb-2 text-2xl font-bold">
                                {t('subscribe.title')}
                            </h2>
                            <p className="text-text-secondary mb-6">
                                {t('subscribe.description')}
                            </p>
                            <p className="text-text-primary mb-6 font-medium">
                                {t('subscribe.plan_label')}
                            </p>
                            <UiButton
                                onClick={handleSubscriptionCheckout}
                                disabled={loadingAction !== null}
                            >
                                {loadingAction === 'subscribe' ? (
                                    <UiSpinner size="sm" />
                                ) : (
                                    t('subscribe.button')
                                )}
                            </UiButton>
                        </>
                    ) : (
                        <>
                            <h2 className="text-text-primary mb-6 text-2xl font-bold">
                                {t('active.title')}
                            </h2>
                            <div className="mb-6 space-y-2">
                                <p className="text-text-secondary">
                                    {billing?.cancelAtPeriodEnd
                                        ? t('active.status_canceling', {
                                              date: formatDate(
                                                  billing?.currentPeriodEnd ?? null,
                                              ),
                                          })
                                        : t('active.status_active')}
                                </p>
                                {billing?.planCode && (
                                    <p className="text-text-secondary">
                                        {t('active.plan_label', {
                                            plan: billing.planCode,
                                        })}
                                    </p>
                                )}
                                {billing?.currentPeriodEnd &&
                                    !billing?.cancelAtPeriodEnd && (
                                        <p className="text-text-secondary">
                                            {t('active.next_billing', {
                                                date: formatDate(
                                                    billing.currentPeriodEnd,
                                                ),
                                            })}
                                        </p>
                                    )}
                                {billing?.cancelAtPeriodEnd && (
                                    <p className="text-warning text-sm">
                                        {t('active.cancel_notice')}
                                    </p>
                                )}
                            </div>
                            <UiButton
                                onClick={handlePortal}
                                disabled={loadingAction !== null}
                            >
                                {loadingAction === 'portal' ? (
                                    <UiSpinner size="sm" />
                                ) : (
                                    t('active.manage_button')
                                )}
                            </UiButton>
                        </>
                    )}
                </section>
            )}

            {/* ── Credits Section (One-Off) ── */}
            {PAYMENTS_ONE_OFF_ENABLED && (
                <section>
                    <h2 className="text-text-primary mb-2 text-2xl font-bold">
                        {t('credits.title')}
                    </h2>
                    <p className="text-text-secondary mb-6">
                        {t('credits.description')}
                    </p>
                    <p className="text-text-secondary mb-6">
                        {t('credits.balance', { count: user.credits.balance })}
                    </p>
                    <div className="space-y-3">
                        {(
                            Object.entries(CREDIT_PACK_CONFIG) as [
                                CreditPackCode,
                                { credits: number },
                            ][]
                        ).map(([packCode, pack]) => (
                            <div
                                key={packCode}
                                className="flex items-center justify-between"
                            >
                                <span className="text-text-primary">
                                    {t('credits.pack_label', {
                                        count: pack.credits,
                                    })}
                                </span>
                                <UiButton
                                    onClick={() => handleOneOffCheckout(packCode)}
                                    disabled={loadingAction !== null}
                                    variant="secondary"
                                    size="sm"
                                >
                                    {loadingAction === `oneoff_${packCode}` ? (
                                        <UiSpinner size="sm" />
                                    ) : (
                                        t('credits.buy_button')
                                    )}
                                </UiButton>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
```

**Примітки:**
- `loadingAction` зберігає ключ активної дії для granular loading states
- `CREDIT_PACK_CONFIG` з `@lucidship/types` — итерується для рендеру пакетів
- `UiButton` потрібен `variant="secondary"` та `size="sm"` — перевір що ці варіанти існують у `UiButton` CVA. Якщо ні — використовуй наявні
- Секції огорнуті в `<section>` для semantics
- Розбивка `space-y-12` між секціями

---

## 5.3 `apps/web/messages/uk.json`

Знайти секцію `billing_page` і додати:

```json
"billing_page": {
    "subscribe": { ... /* існуючі ключі без змін */ },
    "active": { ... /* існуючі ключі без змін */ },
    "credits": {
        "title": "Кредити",
        "description": "Придбайте кредити для перевірки автомобілів. Кожна перевірка списує 1 кредит.",
        "balance": "Поточний баланс: {count} кр.",
        "pack_label": "{count} кредитів",
        "buy_button": "Придбати",
        "error": "Не вдалося створити сесію оплати. Спробуйте ще раз."
    }
}
```

---

## 5.4 `apps/web/messages/en.json`

```json
"billing_page": {
    "subscribe": { ... /* existing keys unchanged */ },
    "active": { ... /* existing keys unchanged */ },
    "credits": {
        "title": "Credits",
        "description": "Purchase credits to check vehicles. Each check uses 1 credit.",
        "balance": "Current balance: {count} cr.",
        "pack_label": "{count} credits",
        "buy_button": "Buy",
        "error": "Failed to create payment session. Please try again."
    }
}
```

---

## Verification Phase 5

```bash
pnpm --filter web build
# Перевірити TypeScript errors в billing/page.tsx

pnpm --filter web test
# Якщо є payments spec — оновити
```

Ручна перевірка:
- `PAYMENTS_SUBSCRIPTION_ENABLED=false` → секція підписки не рендериться
- `PAYMENTS_ONE_OFF_ENABLED=false` → секція кредитів не рендериться
- `CREDIT_PACK_CONFIG` ітерація рендерить 3 пакети (credits_5, credits_10, credits_20)
- `loadingAction` блокує всі кнопки поки одна активна (prevents double-click)
