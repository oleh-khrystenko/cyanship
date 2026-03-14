'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import UiButton from '@/shared/ui/UiButton';
import UiCheckbox from '@/shared/ui/UiCheckbox';
import UiFullPageLoader from '@/shared/ui/UiFullPageLoader';
import UiSpinner from '@/shared/ui/UiSpinner';
import { refreshToken, getMe, restoreAccount, acceptTerms } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

export default function CallbackPage() {
    const t = useTranslations('auth_page.callback');
    const tRecovery = useTranslations('auth_page.recovery');
    const router = useRouter();
    const { locale } = useParams<{ locale: string }>();

    const [accountDeleted, setAccountDeleted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [termsError, setTermsError] = useState('');

    useEffect(() => {
        const isAccountDeleted =
            new URLSearchParams(window.location.search).get(
                'account_deleted'
            ) === 'true';

        const authenticate = async () => {
            try {
                await refreshToken();
                const user = await getMe();

                // getMe succeeds → user is active, ignore URL param
                document.cookie = 'bid_account_deleted=; path=/; max-age=0';
                useAuthStore.getState().setUser(user);

                // Record terms consent for Google OAuth flow
                // (sign-in page checkbox was checked before redirect)
                await acceptTerms().catch(() => {});

                router.replace(`/${locale}/profile`);
            } catch {
                // getMe failed → user is soft-deleted (JwtActiveGuard blocks)
                if (isAccountDeleted) {
                    useAuthStore.getState().clearUser();
                    document.cookie = 'bid_account_deleted=true; path=/';
                    setAccountDeleted(true);
                    return;
                }

                router.replace(`/${locale}/auth/signin`);
            }
        };

        void authenticate();
    }, [router, locale]);

    const handleTermsChange = (checked: boolean) => {
        setAgreedToTerms(checked);
        if (checked) setTermsError('');
    };

    const handleRestore = async () => {
        if (!agreedToTerms) {
            setTermsError(t('terms_required'));
            return;
        }
        setSubmitting(true);
        try {
            await restoreAccount();
            await acceptTerms();
            document.cookie = 'bid_account_deleted=; path=/; max-age=0';
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

                    <UiCheckbox
                        checked={agreedToTerms}
                        onChange={handleTermsChange}
                        size="sm"
                        error={termsError}
                    >
                        {t.rich('terms_agree', {
                            terms: (chunks) => (
                                <a
                                    href={`/${locale}/terms`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline hover:no-underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {chunks}
                                </a>
                            ),
                            privacy: (chunks) => (
                                <a
                                    href={`/${locale}/privacy`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline hover:no-underline"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {chunks}
                                </a>
                            ),
                        })}
                    </UiCheckbox>

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
