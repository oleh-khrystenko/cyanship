'use client';

import { FormEvent, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import {
    UiModal,
    UiModalContent,
    UiModalHeader,
    UiModalTitle,
} from '@/shared/ui/UiModal';
import UiButton from '@/shared/ui/UiButton';
import UiPasswordInput from '@/shared/ui/UiPasswordInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import { confirmDeleteAccount } from '@/shared/api';
import { useDeleteAccountDialogStore } from '@/stores/deleteAccountDialog';

export default function DeleteAccountDialog() {
    const t = useTranslations('delete_account_modal');
    const locale = useLocale();
    const router = useRouter();
    const isOpen = useDeleteAccountDialogStore((s) => s.isOpen);
    const close = useDeleteAccountDialogStore((s) => s.close);

    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleOpenChange = (open: boolean) => {
        if (!open && !submitting) {
            close();
            setPassword('');
            setError('');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            await confirmDeleteAccount(password);
            close();
            setPassword('');
            toast.success(t('deleted'));
            router.push(`/${locale}/auth/signin`);
        } catch (err) {
            const code =
                err instanceof AxiosError
                    ? err.response?.data?.error?.code
                    : undefined;

            if (code === 'UNAUTHORIZED') {
                setError(t('invalid_password'));
            } else if (code === 'RATE_LIMIT_EXCEEDED') {
                setError(t('rate_limit'));
            } else {
                setError(t('error_generic'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <UiModal open={isOpen} onOpenChange={handleOpenChange}>
            <UiModalContent>
                <UiModalHeader>
                    <UiModalTitle>{t('title')}</UiModalTitle>
                </UiModalHeader>
                <div className="px-4 pb-6">
                    <p className="text-muted-foreground text-sm">
                        {t('description')}
                    </p>

                    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                        <UiPasswordInput
                            label={t('password_label')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={error || undefined}
                            required
                            size="lg"
                            autoFocus
                        />

                        <div className="flex justify-end gap-3">
                            <UiButton
                                type="button"
                                variant="text"
                                size="md"
                                onClick={() => handleOpenChange(false)}
                                disabled={submitting}
                            >
                                {t('cancel_button')}
                            </UiButton>
                            <UiButton
                                type="submit"
                                variant="destructive-outline"
                                size="md"
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
            </UiModalContent>
        </UiModal>
    );
}
