'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { ChangePasswordSchema } from '@cyanship/types';
import UiButton from '@/shared/ui/UiButton';
import UiPasswordInput from '@/shared/ui/UiPasswordInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import { changePassword, getMe } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

interface ChangePasswordFormProps {
    onDone: () => void;
    onCancel: () => void;
}

const ChangePasswordForm = ({ onDone, onCancel }: ChangePasswordFormProps) => {
    const t = useTranslations('profile_page.security');

    const setUser = useAuthStore((s) => s.setUser);

    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [currentPwdError, setCurrentPwdError] = useState('');
    const [newPwdError, setNewPwdError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const parsed = ChangePasswordSchema.safeParse({
            currentPassword: currentPwd,
            newPassword: newPwd,
        });
        if (!parsed.success) {
            for (const issue of parsed.error.issues) {
                if (issue.path[0] === 'newPassword') {
                    setNewPwdError(
                        issue.code === 'custom'
                            ? t('password_same_as_current')
                            : t('password_too_short')
                    );
                }
            }
            return;
        }

        setSubmitting(true);
        try {
            await changePassword(currentPwd, newPwd);
            const me = await getMe();
            setUser(me);
            toast.success(t('password_changed'));
            onDone();
        } catch (err) {
            const code =
                err instanceof AxiosError
                    ? err.response?.data?.error?.code
                    : undefined;

            if (code === 'UNAUTHORIZED') {
                setCurrentPwdError(t('password_invalid'));
            } else if (code === 'RATE_LIMIT_EXCEEDED') {
                toast.error(t('error_rate_limit'));
            } else {
                toast.error(t('error_generic'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
                <label className="text-muted-foreground mb-1.5 block text-sm">
                    {t('current_password_label')}
                </label>
                <UiPasswordInput
                    placeholder={t('password_placeholder')}
                    value={currentPwd}
                    onChange={(e) => {
                        setCurrentPwd(e.target.value);
                        if (currentPwdError) setCurrentPwdError('');
                    }}
                    error={currentPwdError || undefined}
                    required
                    size="lg"
                    showLabel={t('show_password')}
                    hideLabel={t('hide_password')}
                />
            </div>

            <div>
                <label className="text-muted-foreground mb-1.5 block text-sm">
                    {t('new_password_label')}
                </label>
                <UiPasswordInput
                    placeholder={t('password_placeholder')}
                    value={newPwd}
                    onChange={(e) => {
                        setNewPwd(e.target.value);
                        if (newPwdError) setNewPwdError('');
                    }}
                    error={newPwdError || undefined}
                    required
                    size="lg"
                    showLabel={t('show_password')}
                    hideLabel={t('hide_password')}
                />
            </div>

            <div className="flex items-center gap-3">
                <UiButton
                    type="submit"
                    variant="filled"
                    size="md"
                    disabled={submitting || !newPwd || !currentPwd}
                >
                    {submitting ? (
                        <UiSpinner size="sm" />
                    ) : (
                        t('change_password')
                    )}
                </UiButton>

                <UiButton
                    type="button"
                    variant="text"
                    size="md"
                    onClick={onCancel}
                    disabled={submitting}
                >
                    {t('cancel')}
                </UiButton>
            </div>
        </form>
    );
};

export default ChangePasswordForm;
