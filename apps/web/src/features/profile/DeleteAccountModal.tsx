'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AxiosError } from 'axios';
import UiButton from '@/shared/ui/UiButton';
import UiPasswordInput from '@/shared/ui/UiPasswordInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import { confirmDeleteAccount } from '@/shared/api';

interface DeleteAccountModalProps {
    onClose: () => void;
    onDeleted: () => void;
}

const DeleteAccountModal = ({
    onClose,
    onDeleted,
}: DeleteAccountModalProps) => {
    const t = useTranslations('delete_account_modal');

    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !submitting) {
                onClose();
            }
        },
        [onClose, submitting]
    );

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !submitting) {
            onClose();
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            await confirmDeleteAccount(password);
            onDeleted();
        } catch (err) {
            const code =
                err instanceof AxiosError
                    ? err.response?.data?.error?.code
                    : undefined;
            if (code === 'UNAUTHORIZED') {
                setError(t('invalid_password'));
            } else {
                setError(t('invalid_password'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={handleBackdropClick}
        >
            <div className="bg-background mx-4 w-full max-w-md rounded-xl p-6 shadow-xl">
                <h2 className="text-foreground text-lg font-semibold">
                    {t('title')}
                </h2>
                <p className="text-muted-foreground mt-2 text-sm">
                    {t('description')}
                </p>

                <form
                    onSubmit={handleSubmit}
                    className="mt-4 space-y-4"
                >
                    <div>
                        <label className="text-muted-foreground mb-1 block text-sm">
                            {t('password_label')}
                        </label>
                        <UiPasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={error || undefined}
                            required
                            size="lg"
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <UiButton
                            type="button"
                            variant="text"
                            size="md"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            {t('cancel_button')}
                        </UiButton>
                        <UiButton
                            type="submit"
                            variant="filled"
                            size="md"
                            className="rounded-lg bg-destructive"
                            disabled={submitting || !password}
                        >
                            {submitting ? (
                                <UiSpinner size="sm" />
                            ) : (
                                t('confirm_button')
                            )}
                        </UiButton>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeleteAccountModal;
