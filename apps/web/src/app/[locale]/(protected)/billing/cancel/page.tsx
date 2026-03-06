'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import UiFullPageLoader from '@/shared/ui/UiFullPageLoader';

export default function BillingCancelPage() {
    const t = useTranslations('billing_page.callback');
    const router = useRouter();
    const { locale } = useParams<{ locale: string }>();

    useEffect(() => {
        toast.info(t('canceled'));
        router.replace(`/${locale}/billing`);
    }, [router, locale, t]);

    return <UiFullPageLoader message={t('loading')} />;
}
