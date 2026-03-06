'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
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
            const { checkoutUrl } =
                await createSubscriptionCheckout('monthly_usd');
            window.location.assign(checkoutUrl);
        } catch {
            toast.error(t('subscribe.error'));
            setLoadingAction(null);
        }
    };

    const handleOneOffCheckout = async (packCode: CreditPackCode) => {
        setLoadingAction(`oneoff_${packCode}`);
        try {
            const { checkoutUrl } = await createOneOffCheckout(packCode);
            window.location.assign(checkoutUrl);
        } catch {
            toast.error(t('credits.error'));
            setLoadingAction(null);
        }
    };

    const handlePortal = async () => {
        setLoadingAction('portal');
        try {
            const { portalUrl } = await createPortalSession();
            window.location.assign(portalUrl);
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
                                disabled={loadingAction === 'subscribe'}
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
                                                  billing?.currentPeriodEnd ??
                                                      null,
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
                                disabled={loadingAction === 'portal'}
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
                        {t('credits.balance', {
                            count: user.credits.balance,
                        })}
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
                                    onClick={() =>
                                        handleOneOffCheckout(packCode)
                                    }
                                    disabled={loadingAction === `oneoff_${packCode}`}
                                    variant="text"
                                    size="sm"
                                >
                                    {loadingAction ===
                                    `oneoff_${packCode}` ? (
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
