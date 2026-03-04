'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import UiButton from '@/shared/ui/UiButton';
import { deleteAccount } from '@/shared/api';
import DeleteAccountModal from './DeleteAccountModal';

const DangerZone = () => {
    const t = useTranslations('profile_page.danger_zone');
    const tModal = useTranslations('delete_account_modal');
    const locale = useLocale();
    const router = useRouter();

    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        try {
            const result = await deleteAccount();

            if (result.requiresPassword) {
                setShowModal(true);
            } else if (result.requiresMagicLink) {
                setEmailSent(true);
            }
        } catch {
            toast.error(tModal('invalid_password'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleted = () => {
        setShowModal(false);
        toast.success(tModal('deleted'));
        router.push(`/${locale}/auth/signin`);
    };

    return (
        <section className="space-y-4">
            <h2 className="text-text-primary text-xl font-semibold">
                {t('heading')}
            </h2>

            <div className="rounded-lg border border-red-300 bg-red-50 p-6 dark:border-red-700 dark:bg-red-900/20">
                <h3 className="text-text-primary font-medium">
                    {t('delete_title')}
                </h3>
                <p className="text-text-secondary mt-1 text-sm">
                    {t('delete_description')}
                </p>
                {emailSent ? (
                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                            {tModal('magic_link_sent_title')}
                        </p>
                        <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                            {tModal('magic_link_sent_description')}
                        </p>
                    </div>
                ) : (
                    <UiButton
                        variant="filled"
                        size="md"
                        className="mt-4 rounded-lg bg-red-600 hover:bg-red-700"
                        onClick={() => void handleDelete()}
                        disabled={loading}
                    >
                        {t('delete_button')}
                    </UiButton>
                )}
            </div>

            {showModal && (
                <DeleteAccountModal
                    onClose={() => setShowModal(false)}
                    onDeleted={handleDeleted}
                />
            )}
        </section>
    );
};

export default DangerZone;
