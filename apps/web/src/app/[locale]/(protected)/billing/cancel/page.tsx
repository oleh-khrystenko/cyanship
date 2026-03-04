'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import UiSpinner from '@/shared/ui/UiSpinner';

export default function BillingCancelPage() {
    const t = useTranslations('billing_page.callback');
    const router = useRouter();
    const { locale } = useParams<{ locale: string }>();

    useEffect(() => {
        toast.info(t('canceled'));
        router.replace(`/${locale}/billing`);
    }, [router, locale, t]);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
            <UiSpinner size="lg" />
            <p className="text-text-secondary text-lg">{t('loading')}</p>
        </main>
    );
}
