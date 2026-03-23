'use client';

import { useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import UiFullPageLoader from '@/shared/ui/UiFullPageLoader';

export default function BillingCancelPage() {
    const t = useTranslations('billing_page.callback');
    const router = useRouter();
    const { locale } = useParams<{ locale: string }>();
    const searchParams = useSearchParams();

    useEffect(() => {
        toast.info(t('canceled'));
        const returnPath = searchParams.get('returnPath');
        const safeReturn = returnPath?.startsWith('/') && !returnPath.startsWith('//')
            ? returnPath
            : null;
        router.replace(safeReturn || `/${locale}/billing`);
    }, [router, locale, t, searchParams]);

    return <UiFullPageLoader message={t('loading')} />;
}
