'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import UiButton from '@/shared/ui/UiButton';
import UiFullPageLoader from '@/shared/ui/UiFullPageLoader';
import UiSpinner from '@/shared/ui/UiSpinner';
import { refreshToken, getMe, restoreAccount } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

export default function CallbackPage() {
    const t = useTranslations('auth_page.callback');
    const tRecovery = useTranslations('auth_page.recovery');
    const router = useRouter();
    const { locale } = useParams<{ locale: string }>();

    const [accountDeleted, setAccountDeleted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const isAccountDeleted =
            new URLSearchParams(window.location.search).get(
                'account_deleted'
            ) === 'true';

        const authenticate = async () => {
            try {
                await refreshToken();

                if (isAccountDeleted) {
                    useAuthStore.getState().clearUser();
                    setAccountDeleted(true);
                    return;
                }

                const user = await getMe();
                useAuthStore.getState().setUser(user);
                router.replace(`/${locale}/profile`);
            } catch {
                router.replace(`/${locale}/auth/signin`);
            }
        };

        void authenticate();
    }, [router, locale]);

    const handleRestore = async () => {
        setSubmitting(true);
        try {
            await restoreAccount();
            toast.success(tRecovery('restored'));
            const user = await getMe();
            useAuthStore.getState().setUser(user);
            router.replace(`/${locale}/profile`);
        } catch {
            setSubmitting(false);
            router.replace(`/${locale}/auth/signin`);
        }
    };

    if (accountDeleted) {
        return (
            <main className="flex min-h-screen items-center justify-center px-4">
                <div className="w-full max-w-md space-y-6 text-center">
                    <h1 className="text-foreground text-3xl font-bold">
                        {tRecovery('title')}
                    </h1>
                    <p className="text-muted-foreground">
                        {t('account_deleted_description')}
                    </p>
                    <UiButton
                        variant="filled"
                        size="lg"
                        className="w-full justify-center rounded-lg"
                        disabled={submitting}
                        onClick={() => void handleRestore()}
                    >
                        {submitting ? (
                            <UiSpinner size="sm" />
                        ) : (
                            tRecovery('restore_button')
                        )}
                    </UiButton>
                </div>
            </main>
        );
    }

    return <UiFullPageLoader message={t('loading')} />;
}
