'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Check } from 'lucide-react';
import { formatPrice, type PaymentsCatalog } from '@cyanship/types';
import { getCatalog } from '@/shared/api/payments';
import UiButton from '@/shared/ui/UiButton';
import { useAuthStore } from '@/stores/auth';

const stepKeys = ['step_1', 'step_2', 'step_3'] as const;

const DogfoodingSection = () => {
    const t = useTranslations('landing_page.dogfooding');
    const locale = useLocale();
    const router = useRouter();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const [catalog, setCatalog] = useState<PaymentsCatalog | null>(null);

    useEffect(() => {
        getCatalog().then(setCatalog).catch(() => {});
    }, []);

    const handleTryClick = () => {
        if (isAuthenticated) {
            router.push(`/${locale}/billing`);
        } else {
            router.push(`/${locale}/auth/signin?redirect=/${locale}/billing`);
        }
    };

    const firstPlan = catalog?.subscriptionPlans[0];
    const cheapestPack = catalog?.executionPacks.length
        ? [...catalog.executionPacks].sort(
              (a, b) => a.priceAmount - b.priceAmount,
          )[0]
        : null;

    const subscriptionPrice = firstPlan
        ? formatPrice(firstPlan.priceAmount, firstPlan.currency)
        : '';
    const executionsFromPrice = cheapestPack
        ? formatPrice(cheapestPack.priceAmount, cheapestPack.currency)
        : '';

    return (
        <section id="dogfooding" className="scroll-mt-28 border-t border-border py-24">
            <div className="container px-6">
                <div className="max-w-2xl">
                    <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                        {t('label')}
                    </span>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                        {t('heading')}
                    </h2>
                    <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                        {t('description')}
                    </p>
                </div>

                <ul className="mt-12 max-w-xl space-y-4">
                    {stepKeys.map((key) => (
                        <li
                            key={key}
                            className="flex items-start gap-4 rounded-lg border border-border bg-card p-4"
                        >
                            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground">
                                <Check className="size-4 text-background" />
                            </div>
                            <span className="text-foreground">
                                {t(key)}
                            </span>
                        </li>
                    ))}
                </ul>

                {/* ── Pricing Preview ── */}
                {catalog && (
                    <div className="mt-10 flex max-w-xl flex-col gap-4 sm:flex-row">
                        {subscriptionPrice && (
                            <div className="flex flex-1 items-center justify-between rounded-lg border border-border bg-card p-4">
                                <span className="text-sm font-medium text-foreground">
                                    {t('preview_subscription', { price: subscriptionPrice })}
                                </span>
                                <UiButton
                                    variant="filled"
                                    size="sm"
                                    onClick={handleTryClick}
                                >
                                    {t('try_cta')}
                                </UiButton>
                            </div>
                        )}

                        {executionsFromPrice && (
                            <div className="flex flex-1 items-center justify-between rounded-lg border border-border bg-card p-4">
                                <span className="text-sm font-medium text-foreground">
                                    {t('preview_executions', { price: executionsFromPrice })}
                                </span>
                                <UiButton
                                    variant="filled"
                                    size="sm"
                                    onClick={handleTryClick}
                                >
                                    {t('try_cta')}
                                </UiButton>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

export default DogfoodingSection;
