'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Pencil, ShieldCheck, ShieldOff } from 'lucide-react';
import type { UserProfile } from '@lucidship/types';
import { passwordSchema } from '@lucidship/types';
import UiButton from '@/shared/ui/UiButton';
import UiPasswordInput from '@/shared/ui/UiPasswordInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import {
    setPassword,
    changePassword,
    getMe,
} from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

export type ProfileMode = 'new' | 'set-password' | null;

interface SecuritySectionProps {
    user: UserProfile;
    mode: ProfileMode;
}

const SecuritySection = ({ user, mode }: SecuritySectionProps) => {
    const t = useTranslations('profile_page.security');

    const setUser = useAuthStore((s) => s.setUser);

    const [editing, setEditing] = useState(false);
    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [currentPwdError, setCurrentPwdError] = useState('');
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

    const resetForm = () => {
        setCurrentPwd('');
        setNewPwd('');
        setCurrentPwdError('');
        setNewPwdError('');
    };

    const handleCancel = () => {
        resetForm();
        setEditing(false);
    };

    const validateNewPassword = (): boolean => {
        const result = passwordSchema.safeParse(newPwd);
        if (!result.success) {
            setNewPwdError(t('password_too_short'));
            return false;
        }
        return true;
    };

    const handleSetPassword = async (e: FormEvent) => {
        e.preventDefault();

        if (isPasswordOptional && !newPwd) {
            return;
        }

        if (!validateNewPassword()) return;

        setSubmitting(true);
        try {
            await setPassword(newPwd);
            const me = await getMe();
            setUser(me);
            toast.success(t('password_set'));
            resetForm();
        } catch {
            setNewPwdError(t('password_invalid'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleChangePassword = async (e: FormEvent) => {
        e.preventDefault();

        if (!validateNewPassword()) return;

        setSubmitting(true);
        try {
            await changePassword(currentPwd, newPwd);
            const me = await getMe();
            setUser(me);
            toast.success(t('password_changed'));
            resetForm();
            setEditing(false);
        } catch {
            setCurrentPwdError(t('password_invalid'));
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
                        className="rounded-lg"
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
                <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
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
                            className="rounded-lg"
                            disabled={
                                submitting || !newPwd || !currentPwd
                            }
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
                            onClick={handleCancel}
                            disabled={submitting}
                        >
                            {t('cancel')}
                        </UiButton>
                    </div>
                </form>
            )}
        </section>
    );
};

export default SecuritySection;
