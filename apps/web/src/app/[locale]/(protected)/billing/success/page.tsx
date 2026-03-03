'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import UiSpinner from '@/shared/ui/UiSpinner';
import { getMe } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

export default function BillingSuccessPage() {
    const t = useTranslations('billing_page.callback');
    const router = useRouter();
    const { locale } = useParams<{ locale: string }>();

    useEffect(() => {
        const handle = async () => {
            try {
                const user = await getMe();
                useAuthStore.getState().setUser(user);
                toast.success(t('success'));
            } catch {
                // User data will refresh on next page load
            }
            router.replace(`/${locale}/billing`);
        };

        void handle();
    }, [router, locale, t]);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
            <UiSpinner size="lg" />
            <p className="text-text-secondary text-lg">{t('loading')}</p>
        </main>
    );
}
