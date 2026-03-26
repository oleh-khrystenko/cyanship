'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import type { PaymentsCatalog } from '@cyanship/types';
import { getCatalog } from '@/shared/api/payments';
import { useAuthStore } from '@/stores/auth';

export default function SubscriptionStatus() {
    const t = useTranslations('dashboard_page.subscription');
    const tPlans = useTranslations('billing_page.plans');
    const locale = useLocale();
    const billing = useAuthStore((s) => s.user?.billing ?? null);

    const hasActive = billing?.hasActiveSubscription === true;

    const [catalog, setCatalog] = useState<PaymentsCatalog | null>(null);

    useEffect(() => {
        if (!hasActive) return;
        getCatalog()
            .then(setCatalog)
            .catch(() => {});
    }, [hasActive]);

    const formatDate = (date: Date | string | null) => {
        if (!date) return '';
        return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(date instanceof Date ? date : new Date(date));
    };

    const activePlan =
        hasActive && catalog
            ? catalog.subscriptionPlans.find(
                  (p) => p.code === billing.planCode
              )
            : null;

    const planName = billing?.planCode
        ? tPlans(`${billing.planCode}.name`, {
              defaultValue: billing.planCode,
          })
        : '';

    return (
        <section className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="size-4" />
                    <span className="font-medium">{t('label')}</span>
                </div>
                <Link
                    href={`/${locale}/billing`}
                    className="text-sm font-medium text-primary hover:underline"
                >
                    {hasActive ? t('manage') : t('view_plans')}
                </Link>
            </div>

            {!hasActive ? (
                <p className="mt-3 text-sm text-muted-foreground">
                    {t('no_active')}
                </p>
            ) : (
                <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                            {t('plan_name', { plan: planName })}
                        </span>
                        <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                billing.cancelAtPeriodEnd
                                    ? 'bg-warning/15 text-warning'
                                    : 'bg-success/15 text-success'
                            }`}
                        >
                            {billing.cancelAtPeriodEnd
                                ? t('status_canceling')
                                : t('status_active')}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {billing.cancelAtPeriodEnd
                            ? t('cancels_on', {
                                  date: formatDate(billing.currentPeriodEnd),
                              })
                            : t('renews_on', {
                                  date: formatDate(billing.currentPeriodEnd),
                              })}
                        {activePlan &&
                            ` · ${t('executions_per_period', {
                                count: activePlan.executions.toLocaleString(
                                    locale === 'uk' ? 'uk-UA' : 'en-US'
                                ),
                            })}`}
                    </p>
                    {billing.scheduledPlanCode && (
                        <p className="mt-1 text-sm text-primary">
                            {t('scheduled_change', {
                                plan: tPlans(
                                    `${billing.scheduledPlanCode}.name`,
                                    {
                                        defaultValue:
                                            billing.scheduledPlanCode,
                                    }
                                ),
                                date: formatDate(
                                    billing.scheduledChangeDate ?? null
                                ),
                            })}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}
