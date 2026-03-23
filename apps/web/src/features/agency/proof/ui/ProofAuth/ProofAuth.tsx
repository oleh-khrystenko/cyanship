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
                router.push(
                    `/${locale}/auth/signin?redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(email)}&step=password`,
                );
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
            <div className="w-full rounded-lg border border-border bg-card p-6">
                <div className="flex flex-col items-center gap-6">
                    <UiAvatar size="2xl">
                        {user.profile.avatar && (
                            <UiAvatarImage
                                src={user.profile.avatar}
                                alt={user.profile.name || user.email}
                            />
                        )}
                        <UiAvatarFallback size="2xl">{initials}</UiAvatarFallback>
                    </UiAvatar>

                    <div className="space-y-1 text-center">
                        {user.profile.name && (
                            <p className="text-xl font-semibold text-foreground">
                                {user.profile.name}
                            </p>
                        )}
                        <p className="text-base text-muted-foreground">{user.email}</p>
                    </div>
                </div>

                <div className="mt-6 border-t border-border pt-4 text-center">
                    <UiButton
                        variant="outline"
                        size="md"
                        onClick={handleLogout}
                        disabled={loggingOut}
                    >
                        {loggingOut ? <UiSpinner size="sm" /> : t('logout_button')}
                    </UiButton>
                </div>
            </div>
        );
    }

    // Magic link sent
    if (state === 'magic-link-sent') {
        return (
            <div className="w-full space-y-6">
                <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center">
                    <Mail className="mx-auto mb-3 h-10 w-10 text-success" />
                    <h3 className="text-lg font-semibold text-foreground">
                        {t('magic_link_sent_title')}
                    </h3>
                    <p className="mt-2 text-base text-muted-foreground">
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

                <div className="flex flex-col items-center gap-3">
                    <UiButton
                        variant="text"
                        size="md"
                        onClick={handleResend}
                        disabled={resendCountdown > 0 || resending}
                        className="font-medium text-primary hover:underline"
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
                        size="md"
                        onClick={goBackToIdle}
                        className="text-muted-foreground hover:underline"
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
        <div className="w-full space-y-5">
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

            <form onSubmit={handleEmailSubmit} className="space-y-4">
                <UiInput
                    type="email"
                    placeholder={t('email_placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    size="lg"
                    IconLeft={<Mail />}
                    error={errorMessage || undefined}
                />

                <UiButton
                    type="submit"
                    variant="filled"
                    size="lg"
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
