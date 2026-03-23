'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { AxiosError } from 'axios';

import UiButton from '@/shared/ui/UiButton';
import UiCheckbox from '@/shared/ui/UiCheckbox';
import UiInput from '@/shared/ui/UiInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import { UiAvatar, UiAvatarImage, UiAvatarFallback } from '@/shared/ui/UiAvatar';
import { GoogleIcon } from '@/shared/icons';
import { ENV } from '@/shared/config';
import { checkEmail, sendMagicLink, logout } from '@/shared/api';
import { saveRedirect } from '@/shared/lib';
import { useAuthStore } from '@/stores/auth';

import type { MagicLinkPurpose } from '@cyanship/types';

type ProofAuthState = 'idle' | 'loading' | 'magic-link-sent';

const ProofAuth = () => {
    const t = useTranslations('landing_page.dogfooding.proof_auth');
    const locale = useLocale();
    const router = useRouter();

    const user = useAuthStore((s) => s.user);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isLoading = useAuthStore((s) => s.isLoading);
    const clearUser = useAuthStore((s) => s.clearUser);

    const [state, setState] = useState<ProofAuthState>('idle');
    const [email, setEmail] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [termsError, setTermsError] = useState('');
    const [resendCountdown, setResendCountdown] = useState(0);
    const [resending, setResending] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const lastPurposeRef = useRef<MagicLinkPurpose>('login');
    const timerRef = useRef<ReturnType<typeof setInterval>>(null);

    const redirectPath = `/${locale}#dogfooding`;

    const startResendTimer = useCallback(() => {
        setResendCountdown(60);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setResendCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const handleTermsChange = (checked: boolean) => {
        setAgreedToTerms(checked);
        if (checked) setTermsError('');
    };

    const handleGoogleSignin = () => {
        if (!agreedToTerms) {
            setTermsError(t('terms_required'));
            return;
        }
        saveRedirect(redirectPath);
        window.location.href = `${ENV.NEXT_PUBLIC_API_URL}/auth/google`;
    };

    const handleEmailSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!agreedToTerms) {
            setTermsError(t('terms_required'));
            return;
        }

        setState('loading');
        setErrorMessage('');

        try {
            const { hasPassword, isNewUser } = await checkEmail(email);

            if (hasPassword) {
                router.push(`/${locale}/auth/signin?redirect=${encodeURIComponent(redirectPath)}`);
                return;
            }

            const purpose: MagicLinkPurpose = isNewUser ? 'register' : 'login';
            lastPurposeRef.current = purpose;
            await sendMagicLink(email, locale, purpose, redirectPath);
            startResendTimer();
            setState('magic-link-sent');
        } catch (err) {
            const code =
                err instanceof AxiosError
                    ? err.response?.data?.error?.code
                    : undefined;

            if (code === 'RATE_LIMIT_EXCEEDED') {
                setErrorMessage(t('error_rate_limit'));
            } else {
                setErrorMessage(t('error_generic'));
            }
            setState('idle');
        }
    };

    const handleResend = async () => {
        setResending(true);
        try {
            await sendMagicLink(email, locale, lastPurposeRef.current, redirectPath);
            startResendTimer();
        } catch {
            // dedup on backend — silent
        } finally {
            setResending(false);
        }
    };

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await logout();
        } catch {
            // silent — token expires naturally
        }
        clearUser();
    };

    const goBackToIdle = () => {
        setState('idle');
        setEmail('');
        setErrorMessage('');
        setTermsError('');
        if (timerRef.current) clearInterval(timerRef.current);
        setResendCountdown(0);
    };

    // Auth store still loading — show spinner, don't flash form
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <UiSpinner size="md" />
            </div>
        );
    }

    // Authenticated view
    if (isAuthenticated && user) {
        const initials = user.profile.name
            ? user.profile.name
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
            : user.email[0].toUpperCase();

        return (
            <div className="flex flex-col items-center gap-5 py-4">
                <UiAvatar size="lg">
                    {user.profile.avatar && (
                        <UiAvatarImage
                            src={user.profile.avatar}
                            alt={user.profile.name || user.email}
                        />
                    )}
                    <UiAvatarFallback size="lg">{initials}</UiAvatarFallback>
                </UiAvatar>

                <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                        {t('authenticated_greeting')}
                    </p>
                    {user.profile.name && (
                        <p className="text-lg font-semibold text-foreground">
                            {user.profile.name}
                        </p>
                    )}
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>

                <UiButton
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    disabled={loggingOut}
                >
                    {loggingOut ? <UiSpinner size="sm" /> : t('logout_button')}
                </UiButton>
            </div>
        );
    }

    // Magic link sent
    if (state === 'magic-link-sent') {
        return (
            <div className="space-y-5">
                <div className="rounded-lg border border-success/30 bg-success/10 p-5 text-center">
                    <Mail className="mx-auto mb-2 h-8 w-8 text-success" />
                    <h3 className="text-base font-semibold text-foreground">
                        {t('magic_link_sent_title')}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t.rich('magic_link_sent_description', {
                            email,
                            bold: (chunks) => (
                                <span className="font-semibold text-foreground">
                                    {chunks}
                                </span>
                            ),
                        })}
                    </p>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <UiButton
                        variant="text"
                        size="sm"
                        onClick={handleResend}
                        disabled={resendCountdown > 0 || resending}
                        className="text-sm font-medium text-primary hover:underline"
                    >
                        {resending ? (
                            <UiSpinner size="sm" />
                        ) : resendCountdown > 0 ? (
                            t('resend_countdown', { seconds: resendCountdown })
                        ) : (
                            t('resend_button')
                        )}
                    </UiButton>

                    <UiButton
                        variant="text"
                        size="sm"
                        onClick={goBackToIdle}
                        className="text-sm text-muted-foreground hover:underline"
                    >
                        &larr; {t('other_email')}
                    </UiButton>
                </div>
            </div>
        );
    }

    // Loading (checkEmail in progress)
    if (state === 'loading') {
        return (
            <div className="flex items-center justify-center py-12">
                <UiSpinner size="md" />
            </div>
        );
    }

    // Default: idle — auth form
    return (
        <div className="space-y-4">
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
                variant="text"
                size="lg"
                className="w-full justify-center gap-3 border border-border bg-card text-foreground hover:bg-secondary hover:text-foreground"
                IconLeft={<GoogleIcon />}
                onClick={handleGoogleSignin}
            >
                {t('google_button')}
            </UiButton>

            <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-sm text-muted-foreground">
                    {t('or_divider')}
                </span>
                <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3">
                <UiInput
                    type="email"
                    placeholder={t('email_placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    IconLeft={<Mail />}
                    error={errorMessage || undefined}
                />

                <UiButton
                    type="submit"
                    variant="filled"
                    size="md"
                    className="w-full justify-center"
                    disabled={!email}
                >
                    {t('continue_button')}
                </UiButton>
            </form>
        </div>
    );
};

export default ProofAuth;
