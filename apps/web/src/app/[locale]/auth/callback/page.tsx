'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import UiSpinner from '@/shared/ui/UiSpinner';
import { refreshToken, getMe } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

export default function CallbackPage() {
    const t = useTranslations('auth_page.callback');
    const router = useRouter();
    const { locale } = useParams<{ locale: string }>();

    useEffect(() => {
        const authenticate = async () => {
            try {
                await refreshToken();
                const user = await getMe();
                useAuthStore.getState().setUser(user);
                router.replace(`/${locale}/profile`);
            } catch {
                router.replace(`/${locale}/auth/signin`);
            }
        };

        void authenticate();
    }, [router, locale]);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
            <UiSpinner size="lg" />
            <p className="text-text-secondary text-lg">{t('loading')}</p>
        </main>
    );
}
