'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { Pencil, ShieldCheck, ShieldOff } from 'lucide-react';
import type { UserProfile } from '@cyanship/types';
import { passwordSchema } from '@cyanship/types';
import UiButton from '@/shared/ui/UiButton';
import UiPasswordInput from '@/shared/ui/UiPasswordInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import { setPassword, getMe } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';
import ChangePasswordForm from './ChangePasswordForm';

export type ProfileMode = 'new' | 'set-password' | null;

interface SecuritySectionProps {
    user: UserProfile;
    mode: ProfileMode;
}

const SecuritySection = ({ user, mode }: SecuritySectionProps) => {
    const t = useTranslations('profile_page.security');

    const setUser = useAuthStore((s) => s.setUser);

    const [editing, setEditing] = useState(false);
    const [newPwd, setNewPwd] = useState('');
    const [newPwdError, setNewPwdError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const hasPassword = user.hasPassword;

    const isSetMode =
        !hasPassword &&
        (mode === 'new' ||
            mode === 'set-password' ||
            mode === null);

    const isChangeMode = hasPassword && (mode === null || mode === undefined);

    const isPasswordOptional = mode === 'new' || mode === 'set-password';

    // View mode: has password, normal mode, not editing
    const isViewMode = isChangeMode && !editing;

    const handleSetPassword = async (e: FormEvent) => {
        e.preventDefault();

        if (isPasswordOptional && !newPwd) {
            return;
        }

        const result = passwordSchema.safeParse(newPwd);
        if (!result.success) {
            setNewPwdError(t('password_too_short'));
            return;
        }

        setSubmitting(true);
        try {
            await setPassword(newPwd);
            const me = await getMe();
            setUser(me);
            toast.success(t('password_set'));
            setNewPwd('');
            setNewPwdError('');
        } catch (err) {
            const code =
                err instanceof AxiosError
                    ? err.response?.data?.error?.code
                    : undefined;

            if (code === 'RATE_LIMIT_EXCEEDED') {
                toast.error(t('error_rate_limit'));
            } else {
                toast.error(t('error_generic'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between">
                <h2 className="text-foreground text-lg font-semibold">
                    {t('heading')}
                </h2>
                {isViewMode && (
                    <UiButton
                        variant="text"
                        size="sm"
                        IconLeft={<Pencil />}
                        onClick={() => setEditing(true)}
                    >
                        {t('edit_button')}
                    </UiButton>
                )}
            </div>
            {isSetMode && (
                <p className="text-muted-foreground mt-1 text-sm">
                    {isPasswordOptional
                        ? t('set_password_optional')
                        : t('set_password')}
                </p>
            )}

            {/* View mode — password status */}
            {isViewMode && (
                <dl className="mt-5">
                    <div className="flex items-center gap-2">
                        <dt className="text-muted-foreground text-sm">
                            {t('password_label')}
                        </dt>
                        <dd className="flex items-center gap-1.5">
                            <ShieldCheck className="size-4 text-success" />
                            <span className="text-success text-sm font-medium">
                                {t('password_active')}
                            </span>
                        </dd>
                    </div>
                </dl>
            )}

            {/* Set password mode */}
            {isSetMode && (
                <form onSubmit={handleSetPassword} className="mt-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <ShieldOff className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground text-sm">
                            {t('password_not_set')}
                        </span>
                    </div>
                    <UiPasswordInput
                        placeholder={t('password_placeholder')}
                        value={newPwd}
                        onChange={(e) => {
                            setNewPwd(e.target.value);
                            if (newPwdError) setNewPwdError('');
                        }}
                        error={newPwdError || undefined}
                        required={!isPasswordOptional}
                        size="lg"
                        showLabel={t('show_password')}
                        hideLabel={t('hide_password')}
                    />
                    <UiButton
                        type="submit"
                        variant="filled"
                        size="md"
                        disabled={
                            submitting ||
                            (!isPasswordOptional && !newPwd)
                        }
                    >
                        {submitting ? (
                            <UiSpinner size="sm" />
                        ) : (
                            t('set_password')
                        )}
                    </UiButton>
                </form>
            )}

            {/* Change password form */}
            {isChangeMode && editing && (
                <ChangePasswordForm
                    onDone={() => setEditing(false)}
                    onCancel={() => setEditing(false)}
                />
            )}
        </section>
    );
};

export default SecuritySection;
