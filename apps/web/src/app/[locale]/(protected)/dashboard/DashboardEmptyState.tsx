'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import UiButton from '@/shared/ui/UiButton';
import {
    PAYMENTS_SUBSCRIPTION_ENABLED,
    PAYMENTS_ONE_OFF_ENABLED,
} from '@/shared/config/env';

type DescriptionKey = 'description_both' | 'description_subscribe' | 'description_purchase';

function getDescriptionKey(): DescriptionKey {
    if (PAYMENTS_SUBSCRIPTION_ENABLED && PAYMENTS_ONE_OFF_ENABLED)
        return 'description_both';
    if (PAYMENTS_SUBSCRIPTION_ENABLED) return 'description_subscribe';
    return 'description_purchase';
}

export default function DashboardEmptyState() {
    const t = useTranslations('dashboard_page.empty_state');
    const locale = useLocale();

    return (
        <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center md:p-8">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-5" />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-foreground">
                {t('title')}
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {t(getDescriptionKey())}
            </p>

            <div className="mt-5">
                <UiButton
                    as="link"
                    href={`/${locale}/billing`}
                    size="sm"
                >
                    {t('cta')}
                </UiButton>
            </div>
        </section>
    );
}
