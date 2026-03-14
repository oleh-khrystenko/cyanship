'use client';

import { Suspense, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { passwordSchema } from '@lucidship/types';

import UiButton from '@/shared/ui/UiButton';
import UiPasswordInput from '@/shared/ui/UiPasswordInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import UiFullPageLoader from '@/shared/ui/UiFullPageLoader';
import { resetPassword } from '@/shared/api';

type PageStatus = 'form' | 'submitting' | 'error';

function ResetPasswordContent() {
    const t = useTranslations('auth_page.reset_password');
    const router = useRouter();
    const { locale } = useParams<{ locale: string }>();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<PageStatus>(token ? 'form' : 'error');
    const [fieldErrors, setFieldErrors] = useState<{
        newPassword?: string;
        confirmPassword?: string;
    }>({});
    const [errorMessage, setErrorMessage] = useState(
        token ? '' : t('error_invalid_token')
    );

    const validate = (): boolean => {
        const errors: typeof fieldErrors = {};

        const result = passwordSchema.safeParse(newPassword);
        if (!result.success) {
            errors.newPassword = t('password_too_short');
        }

        if (newPassword !== confirmPassword) {
            errors.confirmPassword = t('passwords_mismatch');
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || !token) return;

        setStatus('submitting');

        try {
            await resetPassword(token, newPassword, confirmPassword);
            toast.success(t('success_toast'));
            router.replace(`/${locale}/auth/signin`);
        } catch (err) {
            setStatus('error');
            const code =
                err instanceof AxiosError
                    ? err.response?.data?.error?.code
                    : undefined;

            if (code === 'UNAUTHORIZED' || code === 'INVALID_MAGIC_LINK') {
                setErrorMessage(t('error_invalid_token'));
            } else {
                setErrorMessage(t('error_generic'));
            }
        }
    };

    if (status === 'error') {
        return (
            <main className="flex min-h-screen items-center justify-center px-4">
                <div className="w-full max-w-md space-y-6 text-center">
                    <div className="border-destructive rounded-lg border p-6">
                        <p className="text-foreground text-sm">
                            {errorMessage}
                        </p>
                    </div>
                    <UiButton
                        as="link"
                        href={`/${locale}/auth/signin`}
                        variant="filled"
                        size="lg"
                    >
                        {t('back_to_signin')}
                    </UiButton>
                </div>
            </main>
        );
    }

    const isSubmitting = status === 'submitting';

    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-md space-y-8">
                <div className="space-y-2 text-center">
                    <h1 className="text-foreground text-2xl font-semibold">
                        {t('heading')}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {t('description')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <UiPasswordInput
                        placeholder={t('new_password_placeholder')}
                        value={newPassword}
                        onChange={(e) => {
                            setNewPassword(e.target.value);
                            if (fieldErrors.newPassword) {
                                setFieldErrors((prev) => ({
                                    ...prev,
                                    newPassword: undefined,
                                }));
                            }
                        }}
                        error={fieldErrors.newPassword}
                        disabled={isSubmitting}
                        autoFocus
                        size="lg"
                    />

                    <UiPasswordInput
                        placeholder={t('confirm_password_placeholder')}
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (fieldErrors.confirmPassword) {
                                setFieldErrors((prev) => ({
                                    ...prev,
                                    confirmPassword: undefined,
                                }));
                            }
                        }}
                        error={fieldErrors.confirmPassword}
                        disabled={isSubmitting}
                        size="lg"
                    />

                    <UiButton
                        variant="filled"
                        size="lg"
                        disabled={isSubmitting}
                        className="w-full"
                    >
                        {isSubmitting ? (
                            <UiSpinner size="sm" />
                        ) : (
                            t('submit_button')
                        )}
                    </UiButton>
                </form>

                <div className="text-center">
                    <UiButton
                        as="link"
                        href={`/${locale}/auth/signin`}
                        variant="text"
                        size="sm"
                    >
                        {t('back_to_signin')}
                    </UiButton>
                </div>
            </div>
        </main>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<UiFullPageLoader />}>
            <ResetPasswordContent />
        </Suspense>
    );
}
