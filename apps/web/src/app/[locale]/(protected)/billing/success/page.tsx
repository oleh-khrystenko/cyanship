'use client';

import { useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import UiFullPageLoader from '@/shared/ui/UiFullPageLoader';
import { getMe } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

export default function BillingSuccessPage() {
    const t = useTranslations('billing_page.callback');
    const router = useRouter();
    const { locale } = useParams<{ locale: string }>();
    const searchParams = useSearchParams();

    useEffect(() => {
        const handle = async () => {
            try {
                const user = await getMe();
                useAuthStore.getState().setUser(user);
                toast.success(t('success'));
            } catch {
                toast.error(t('refresh_error'));
            }
            const returnPath = searchParams.get('returnPath');
            const safeReturn = returnPath?.startsWith('/') && !returnPath.startsWith('//')
                ? returnPath
                : null;
            router.replace(safeReturn || `/${locale}/billing`);
        };

        void handle();
    }, [router, locale, t, searchParams]);

    return <UiFullPageLoader message={t('loading')} />;
}
