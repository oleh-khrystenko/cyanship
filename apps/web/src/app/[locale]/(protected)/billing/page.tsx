'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import UiButton from '@/shared/ui/UiButton';
import UiSpinner from '@/shared/ui/UiSpinner';
import { useAuthStore } from '@/stores/auth';
import {
    createCheckoutSession,
    createPortalSession,
} from '@/shared/api/payments';

export default function BillingPage() {
    const t = useTranslations('billing_page');
    const locale = useLocale();
    const user = useAuthStore((s) => s.user);
    const [isLoading, setIsLoading] = useState(false);

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

    const handleCheckout = async () => {
        setIsLoading(true);
        try {
            const { checkoutUrl } = await createCheckoutSession(
                'monthly_usd',
            );
            window.location.href = checkoutUrl;
        } catch {
            toast.error(t('subscribe.error'));
            setIsLoading(false);
        }
    };

    const handlePortal = async () => {
        setIsLoading(true);
        try {
            const { portalUrl } = await createPortalSession();
            window.location.href = portalUrl;
        } catch {
            toast.error(t('active.manage_error'));
            setIsLoading(false);
        }
    };

    if (!hasActive) {
        return (
            <div className="mx-auto max-w-lg px-4 py-12">
                <h1 className="text-text-primary mb-2 text-2xl font-bold">
                    {t('subscribe.title')}
                </h1>
                <p className="text-text-secondary mb-6">
                    {t('subscribe.description')}
                </p>
                <p className="text-text-primary mb-6 font-medium">
                    {t('subscribe.plan_label')}
                </p>
                <UiButton
                    onClick={handleCheckout}
                    disabled={isLoading}
                >
                    {isLoading ? <UiSpinner size="sm" /> : t('subscribe.button')}
                </UiButton>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-lg px-4 py-12">
            <h1 className="text-text-primary mb-6 text-2xl font-bold">
                {t('active.title')}
            </h1>

            <div className="mb-6 space-y-2">
                <p className="text-text-primary">
                    <span className="text-text-secondary">
                        {billing?.cancelAtPeriodEnd
                            ? t('active.status_canceling', {
                                  date: formatDate(
                                      billing?.currentPeriodEnd ?? null,
                                  ),
                              })
                            : t('active.status_active')}
                    </span>
                </p>

                {billing?.planCode && (
                    <p className="text-text-secondary">
                        {t('active.plan_label', {
                            plan: billing.planCode,
                        })}
                    </p>
                )}

                {billing?.currentPeriodEnd && !billing?.cancelAtPeriodEnd && (
                    <p className="text-text-secondary">
                        {t('active.next_billing', {
                            date: formatDate(billing.currentPeriodEnd),
                        })}
                    </p>
                )}

                {billing?.cancelAtPeriodEnd && (
                    <p className="text-warning text-sm">
                        {t('active.cancel_notice')}
                    </p>
                )}
            </div>

            <UiButton onClick={handlePortal} disabled={isLoading}>
                {isLoading ? (
                    <UiSpinner size="sm" />
                ) : (
                    t('active.manage_button')
                )}
            </UiButton>
        </div>
    );
}
