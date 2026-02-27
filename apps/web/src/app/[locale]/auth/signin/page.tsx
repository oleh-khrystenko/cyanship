'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import UiButton from '@/shared/ui/UiButton';
import UiInput from '@/shared/ui/UiInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import { GoogleIcon } from '@/shared/icons';
import { ENV } from '@/shared/config';
import {
    checkEmail,
    loginWithPassword,
    sendMagicLink,
    restoreAccount,
    getMe,
    getApiMessageKey,
} from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

type SigninState =
    | 'email'
    | 'loading'
    | 'password'
    | 'magic-link-sent'
    | 'recovery'
    | 'error';

export default function SigninPage() {
    const t = useTranslations('auth_page.signin');
    const tRecovery = useTranslations('auth_page.recovery');
    const tErrors = useTranslations();
    const locale = useLocale();
    const router = useRouter();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const setUser = useAuthStore((s) => s.setUser);

    const [state, setState] = useState<SigninState>('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showMagicLinkSuggestion, setShowMagicLinkSuggestion] =
        useState(false);
    const [deletedAt, setDeletedAt] = useState<string | null>(null);
    const [deletedDaysLeft, setDeletedDaysLeft] = useState(0);

    useEffect(() => {
        if (isAuthenticated) {
            router.replace(`/${locale}/profile`);
        }
    }, [isAuthenticated, locale, router]);

    const handleError = (err: unknown, fallbackKey?: string) => {
        const code =
            err instanceof AxiosError
                ? err.response?.data?.error?.code
                : undefined;

        if (code === 'RATE_LIMIT_EXCEEDED') {
            const retryAfter =
                err instanceof AxiosError
                    ? err.response?.headers?.['retry-after']
                    : undefined;
            const minutes = retryAfter
                ? Math.ceil(Number(retryAfter) / 60)
                : 15;
            setErrorMessage(t('too_many_attempts', { minutes }));
        } else if (code) {
            setErrorMessage(
                tErrors(getApiMessageKey(code, fallbackKey ?? 'auth'))
            );
        } else {
            setErrorMessage(t('error_generic'));
        }
    };

    const handleEmailSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setState('loading');
        setErrorMessage('');

        try {
            const { hasPassword, isNewUser } = await checkEmail(email);

            if (hasPassword) {
                setState('password');
            } else {
                const purpose = isNewUser ? 'register' : 'login';
                await sendMagicLink(email, locale, purpose);
                setState('magic-link-sent');
            }
        } catch (err) {
            handleError(err);
            setState('error');
        }
    };

    const handlePasswordSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMessage('');

        try {
            const result = await loginWithPassword(email, password);

            if (result.accountDeleted) {
                const deleted = result.user.deletedAt
                    ? new Date(result.user.deletedAt)
                    : new Date();
                const gracePeriodEnd = new Date(deleted);
                gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);
                const daysLeft = Math.max(
                    0,
                    Math.ceil(
                        (gracePeriodEnd.getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24)
                    )
                );

                setDeletedAt(deleted.toLocaleDateString(locale));
                setDeletedDaysLeft(daysLeft);
                setState('recovery');
            } else {
                const me = await getMe();
                setUser(me);
                router.push(`/${locale}/profile`);
            }
        } catch (err) {
            setSubmitting(false);
            const code =
                err instanceof AxiosError
                    ? err.response?.data?.error?.code
                    : undefined;

            if (code === 'RATE_LIMIT_EXCEEDED') {
                setShowMagicLinkSuggestion(true);
                handleError(err);
            } else if (code === 'UNAUTHORIZED') {
                setErrorMessage(t('invalid_credentials'));
            } else {
                handleError(err);
            }
        }
    };

    const handleForgotPassword = async () => {
        setSubmitting(true);
        try {
            await sendMagicLink(email, locale, 'reset-password');
            toast.success(t('forgot_password_sent'));
            setState('magic-link-sent');
        } catch {
            toast.success(t('forgot_password_sent'));
            setState('magic-link-sent');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRestore = async () => {
        setSubmitting(true);
        try {
            await restoreAccount();
            toast.success(tRecovery('restored'));
            const me = await getMe();
            setUser(me);
            router.push(`/${locale}/profile`);
        } catch (err) {
            setSubmitting(false);
            handleError(err);
            setState('error');
        }
    };

    const handleSendMagicLinkFromPassword = async () => {
        setSubmitting(true);
        try {
            await sendMagicLink(email, locale, 'login');
            setState('magic-link-sent');
            setShowMagicLinkSuggestion(false);
        } catch {
            setState('magic-link-sent');
            setShowMagicLinkSuggestion(false);
        } finally {
            setSubmitting(false);
        }
    };

    const goBackToEmail = () => {
        setState('email');
        setPassword('');
        setErrorMessage('');
        setSubmitting(false);
        setShowMagicLinkSuggestion(false);
    };

    // --- Header ---
    const renderHeader = () => (
        <div className="text-center">
            <h1 className="text-text-primary text-3xl font-bold">
                {state === 'recovery'
                    ? tRecovery('title')
                    : t('heading')}
            </h1>
            {state === 'email' && (
                <p className="text-text-secondary mt-2">
                    {t('subheading')}
                </p>
            )}
        </div>
    );

    // --- State: email ---
    const renderEmailState = () => (
        <>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
                <UiInput
                    type="email"
                    placeholder={t('email_placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    IconLeft={Mail}
                    size="lg"
                />

                <UiButton
                    type="submit"
                    variant="filled"
                    size="lg"
                    className="w-full justify-center rounded-lg"
                    disabled={!email}
                >
                    {t('continue_button')}
                </UiButton>
            </form>

            <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-600" />
                <span className="text-text-secondary text-sm">
                    {t('or_divider')}
                </span>
                <div className="h-px flex-1 bg-neutral-300 dark:bg-neutral-600" />
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
        </>
    );

    // --- State: loading ---
    const renderLoadingState = () => (
        <div className="flex justify-center py-8">
            <UiSpinner size="lg" />
        </div>
    );

    // --- State: password ---
    const renderPasswordState = () => (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="relative">
                <UiInput
                    type="email"
                    value={email}
                    readOnly
                    IconLeft={Mail}
                    size="lg"
                    className="pr-20"
                />
                <button
                    type="button"
                    onClick={goBackToEmail}
                    className="text-primary absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium hover:underline"
                >
                    {t('change_email')}
                </button>
            </div>

            <div className="relative">
                <UiInput
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('password_placeholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={errorMessage || undefined}
                    required
                    size="lg"
                    autoFocus
                    className="pr-12"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-text-secondary hover:text-text-primary absolute right-3 top-[18px] -translate-y-1/2"
                >
                    {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                    ) : (
                        <Eye className="h-5 w-5" />
                    )}
                </button>
            </div>

            <div className="text-right">
                <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={submitting}
                    className="text-primary text-sm font-medium hover:underline"
                >
                    {t('forgot_password')}
                </button>
            </div>

            <UiButton
                type="submit"
                variant="filled"
                size="lg"
                className="w-full justify-center rounded-lg"
                disabled={submitting || !password}
            >
                {submitting ? (
                    <UiSpinner size="sm" />
                ) : (
                    t('signin_button')
                )}
            </UiButton>

            {showMagicLinkSuggestion && (
                <UiButton
                    type="button"
                    variant="filled"
                    size="lg"
                    className="w-full justify-center rounded-lg border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                    disabled={submitting}
                    onClick={handleSendMagicLinkFromPassword}
                    IconLeft={Mail}
                >
                    {t('login_via_email_link')}
                </UiButton>
            )}
        </form>
    );

    // --- State: magic-link-sent ---
    const renderMagicLinkSentState = () => (
        <div className="space-y-6">
            <div className="rounded-lg border border-green-300 bg-green-50 p-6 text-center dark:border-green-700 dark:bg-green-900/20">
                <Mail className="mx-auto mb-3 h-10 w-10 text-green-600 dark:text-green-400" />
                <h2 className="text-text-primary text-lg font-semibold">
                    {t('magic_link_sent_title')}
                </h2>
                <p className="text-text-secondary mt-1 text-sm">
                    {t('magic_link_sent_description', { email })}
                </p>
            </div>

            <button
                type="button"
                onClick={goBackToEmail}
                className="text-primary mx-auto block text-sm font-medium hover:underline"
            >
                &larr; {t('other_email')}
            </button>
        </div>
    );

    // --- State: recovery ---
    const renderRecoveryState = () => (
        <div className="space-y-4">
            <p className="text-text-secondary text-center">
                {tRecovery('description', {
                    date: deletedAt ?? '',
                    days: deletedDaysLeft,
                })}
            </p>

            <UiButton
                variant="filled"
                size="lg"
                className="w-full justify-center rounded-lg"
                disabled={submitting}
                onClick={handleRestore}
            >
                {submitting ? (
                    <UiSpinner size="sm" />
                ) : (
                    tRecovery('restore_button')
                )}
            </UiButton>

            <UiButton
                variant="text"
                size="lg"
                className="w-full justify-center rounded-lg"
                onClick={goBackToEmail}
            >
                {tRecovery('logout_button')}
            </UiButton>
        </div>
    );

    // --- State: error ---
    const renderErrorState = () => (
        <div className="space-y-4">
            <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-center dark:border-red-700 dark:bg-red-900/20">
                <p className="text-error text-sm font-medium">
                    {errorMessage || t('error_generic')}
                </p>
            </div>

            <UiButton
                variant="filled"
                size="lg"
                className="w-full justify-center rounded-lg"
                onClick={goBackToEmail}
            >
                {t('continue_button')}
            </UiButton>
        </div>
    );

    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-md space-y-8">
                {renderHeader()}

                {state === 'email' && renderEmailState()}
                {state === 'loading' && renderLoadingState()}
                {state === 'password' && renderPasswordState()}
                {state === 'magic-link-sent' && renderMagicLinkSentState()}
                {state === 'recovery' && renderRecoveryState()}
                {state === 'error' && renderErrorState()}
            </div>
        </main>
    );
}
