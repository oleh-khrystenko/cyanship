'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { UserProfile } from '@lucidship/types';
import { AxiosError } from 'axios';
import UiButton from '@/shared/ui/UiButton';
import UiPasswordInput from '@/shared/ui/UiPasswordInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import {
    setPassword,
    changePassword,
    deletePassword,
    getMe,
} from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

export type ProfileMode = 'new' | 'set-password' | 'reset-password' | null;

interface SecuritySectionProps {
    user: UserProfile;
    mode: ProfileMode;
}

const SecuritySection = ({ user, mode }: SecuritySectionProps) => {
    const t = useTranslations('profile_page.security');

    const setUser = useAuthStore((s) => s.setUser);

    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const hasPassword = user.hasPassword;

    const isSetMode =
        !hasPassword &&
        (mode === 'new' ||
            mode === 'set-password' ||
            mode === 'reset-password' ||
            mode === null);

    const isChangeMode = hasPassword && (mode === null || mode === undefined);

    const isResetMode = hasPassword && mode === 'reset-password';

    const isPasswordRequired =
        mode === 'reset-password' ||
        (mode === null && !hasPassword);

    const isPasswordOptional = mode === 'new' || mode === 'set-password';

    const getHeading = () => {
        if (isSetMode) {
            return isPasswordOptional
                ? t('set_password_optional')
                : t('set_password');
        }
        if (isResetMode) return t('change_password');
        if (isChangeMode) return t('change_password');
        return t('set_password');
    };

    const handleSetPassword = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await setPassword(newPwd);
            const me = await getMe();
            setUser(me);
            toast.success(t('password_set'));
            setNewPwd('');
        } catch {
            toast.error(t('password_invalid'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleChangePassword = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (isResetMode) {
                await setPassword(newPwd);
            } else {
                await changePassword(currentPwd, newPwd);
            }
            const me = await getMe();
            setUser(me);
            toast.success(
                isResetMode ? t('password_set') : t('password_changed')
            );
            setCurrentPwd('');
            setNewPwd('');
        } catch (err) {
            const code =
                err instanceof AxiosError
                    ? err.response?.data?.error?.code
                    : undefined;
            if (code === 'UNAUTHORIZED') {
                toast.error(t('password_invalid'));
            } else {
                toast.error(t('password_invalid'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePassword = async () => {
        setSubmitting(true);
        try {
            await deletePassword();
            const me = await getMe();
            setUser(me);
            toast.success(t('password_deleted'));
            setConfirmDelete(false);
        } catch {
            toast.error(t('password_invalid'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="space-y-4">
            <h2 className="text-text-primary text-xl font-semibold">
                {t('heading')}
            </h2>

            {/* Set password mode */}
            {isSetMode && (
                <form onSubmit={handleSetPassword} className="space-y-3">
                    <p className="text-text-secondary text-sm">
                        {getHeading()}
                    </p>
                    <UiPasswordInput
                        placeholder={t('password_placeholder')}
                        value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                        required={isPasswordRequired}
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
                            (isPasswordRequired ? !newPwd : false)
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

            {/* Change password mode (has password, default or reset) */}
            {(isChangeMode || isResetMode) && (
                <form onSubmit={handleChangePassword} className="space-y-3">
                    <p className="text-text-secondary text-sm">
                        {getHeading()}
                    </p>

                    {/* Current password — only in change mode, not reset */}
                    {isChangeMode && (
                        <div>
                            <label className="text-text-secondary mb-1 block text-sm">
                                {t('current_password_label')}
                            </label>
                            <UiPasswordInput
                                placeholder={t('password_placeholder')}
                                value={currentPwd}
                                onChange={(e) =>
                                    setCurrentPwd(e.target.value)
                                }
                                required
                                size="lg"
                                showLabel={t('show_password')}
                                hideLabel={t('hide_password')}
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-text-secondary mb-1 block text-sm">
                            {t('new_password_label')}
                        </label>
                        <UiPasswordInput
                            placeholder={t('password_placeholder')}
                            value={newPwd}
                            onChange={(e) => setNewPwd(e.target.value)}
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
                                submitting ||
                                !newPwd ||
                                (isChangeMode && !currentPwd)
                            }
                        >
                            {submitting ? (
                                <UiSpinner size="sm" />
                            ) : (
                                t('change_password')
                            )}
                        </UiButton>

                        {isChangeMode && (
                            <UiButton
                                type="button"
                                variant="text"
                                size="md"
                                className="text-error"
                                onClick={() => setConfirmDelete(true)}
                                disabled={submitting}
                            >
                                {t('delete_password')}
                            </UiButton>
                        )}
                    </div>
                </form>
            )}

            {/* Delete password confirmation */}
            {confirmDelete && (
                <div className="rounded-lg border border-error/30 bg-error/10 p-4">
                    <p className="text-text-primary mb-3 text-sm">
                        {t('delete_password_confirm')}
                    </p>
                    <div className="flex gap-3">
                        <UiButton
                            variant="filled"
                            size="sm"
                            className="rounded-lg bg-error"
                            onClick={() => void handleDeletePassword()}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <UiSpinner size="sm" />
                            ) : (
                                t('delete_password')
                            )}
                        </UiButton>
                        <UiButton
                            variant="text"
                            size="sm"
                            onClick={() => setConfirmDelete(false)}
                            disabled={submitting}
                        >
                            {t('cancel')}
                        </UiButton>
                    </div>
                </div>
            )}
        </section>
    );
};

export default SecuritySection;
