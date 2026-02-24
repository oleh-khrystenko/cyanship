'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import UiButton from '@/shared/ui/UiButton';
import UiInput from '@/shared/ui/UiInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import { GoogleIcon } from '@/shared/icons';
import { ENV } from '@/shared/config';
import { sendMagicLink, getApiMessageKey } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';
import { AxiosError } from 'axios';

type SigninStatus = 'idle' | 'sending' | 'sent' | 'error';

export default function SigninPage() {
    const t = useTranslations('auth_page.signin');
    const tErrors = useTranslations();
    const locale = useLocale();
    const router = useRouter();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<SigninStatus>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (isAuthenticated) {
            router.replace(`/${locale}/check`);
        }
    }, [isAuthenticated, locale, router]);

    const handleMagicLink = async (e: FormEvent) => {
        e.preventDefault();
        setStatus('sending');
        setErrorMessage('');

        try {
            await sendMagicLink(email, locale);
            setStatus('sent');
        } catch (err) {
            setStatus('error');
            const code =
                err instanceof AxiosError
                    ? err.response?.data?.error?.code
                    : undefined;
            setErrorMessage(
                code
                    ? tErrors(getApiMessageKey(code, 'auth'))
                    : t('error_generic')
            );
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-text-primary text-3xl font-bold">
                        {t('heading')}
                    </h1>
                    <p className="text-text-secondary mt-2">
                        {t('subheading')}
                    </p>
                </div>

                <UiButton
                    as="a"
                    href={`${ENV.NEXT_PUBLIC_API_URL}/auth/google`}
                    variant="filled"
                    size="lg"
                    className="w-full justify-center gap-3 rounded-lg border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                    IconLeft={GoogleIcon}
                >
                    {t('google_button')}
                </UiButton>

                <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-600" />
                    <span className="text-text-secondary text-sm">
                        {t('divider')}
                    </span>
                    <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-600" />
                </div>

                {status === 'sent' ? (
                    <div className="rounded-lg border border-green-300 bg-green-50 p-6 text-center dark:border-green-700 dark:bg-green-900/20">
                        <Mail className="mx-auto mb-3 h-10 w-10 text-green-600 dark:text-green-400" />
                        <h2 className="text-text-primary text-lg font-semibold">
                            {t('sent_heading')}
                        </h2>
                        <p className="text-text-secondary mt-1 text-sm">
                            {t('sent_description')}
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleMagicLink} className="space-y-4">
                        <UiInput
                            type="email"
                            placeholder={t('email_placeholder')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            error={
                                status === 'error' ? errorMessage : undefined
                            }
                            required
                            IconLeft={Mail}
                            size="lg"
                        />

                        <UiButton
                            type="submit"
                            variant="filled"
                            size="lg"
                            className="w-full justify-center rounded-lg"
                            disabled={status === 'sending' || !email}
                        >
                            {status === 'sending' ? (
                                <UiSpinner size="sm" />
                            ) : (
                                t('magic_link_button')
                            )}
                        </UiButton>
                    </form>
                )}
            </div>
        </main>
    );
}
