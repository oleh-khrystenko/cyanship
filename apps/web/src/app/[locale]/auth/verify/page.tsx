'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import UiSpinner from '@/shared/ui/UiSpinner';
import UiButton from '@/shared/ui/UiButton';
import { verifyMagicLink, getMe } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

type VerifyStatus = 'verifying' | 'success' | 'error';

function VerifyContent() {
    const t = useTranslations('auth_page.verify');
    const router = useRouter();
    const { locale } = useParams<{ locale: string }>();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<VerifyStatus>(
        token ? 'verifying' : 'error'
    );

    useEffect(() => {
        if (!token) return;

        const verify = async () => {
            try {
                await verifyMagicLink(token);
                const user = await getMe();
                useAuthStore.getState().setUser(user);
                setStatus('success');
                router.replace(`/${locale}/check`);
            } catch {
                setStatus('error');
            }
        };

        void verify();
    }, [token, router, locale]);

    if (status === 'error') {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
                <p className="text-text-primary text-lg">
                    {t('error_heading')}
                </p>
                <p className="text-text-secondary text-sm">
                    {t('error_description')}
                </p>
                <UiButton
                    as="link"
                    href={`/${locale}/auth/signin`}
                    variant="filled"
                    size="md"
                    className="rounded-lg"
                >
                    {t('retry_button')}
                </UiButton>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
            <UiSpinner size="lg" />
            <p className="text-text-secondary text-lg">
                {status === 'success' ? t('redirecting') : t('verifying')}
            </p>
        </main>
    );
}

export default function VerifyPage() {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-screen flex-col items-center justify-center gap-4">
                    <UiSpinner size="lg" />
                </main>
            }
        >
            <VerifyContent />
        </Suspense>
    );
}
