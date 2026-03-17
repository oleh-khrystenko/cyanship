'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import UiButton from '@/shared/ui/UiButton';
import { deleteAccount } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';
import DeleteAccountModal from './DeleteAccountModal';

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_SEC = 60;

const DangerZone = () => {
    const t = useTranslations('profile_page.danger_zone');
    const tModal = useTranslations('delete_account_modal');
    const locale = useLocale();
    const router = useRouter();

    const user = useAuthStore((s) => s.user);
    const setUser = useAuthStore((s) => s.setUser);

    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cooldownSec, setCooldownSec] = useState(0);

    useEffect(() => {
        if (cooldownSec <= 0) return;
        const timer = setInterval(() => {
            setCooldownSec((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldownSec]);

    const requestedAt = user?.accountDeletionRequestedAt
        ? new Date(user.accountDeletionRequestedAt)
        : null;
    const isPendingDeletion =
        requestedAt !== null &&
        Date.now() - requestedAt.getTime() < MAGIC_LINK_TTL_MS;

    const handleDelete = async () => {
        setLoading(true);
        try {
            const result = await deleteAccount();

            if (result.requiresPassword) {
                setShowModal(true);
            } else if (result.requiresMagicLink) {
                if (user) {
                    setUser({
                        ...user,
                        accountDeletionRequestedAt: new Date(),
                    });
                }
                setCooldownSec(RESEND_COOLDOWN_SEC);
                toast.success(tModal('magic_link_sent'));
            }
        } catch (error) {
            const is429 =
                error instanceof AxiosError && error.response?.status === 429;
            toast.error(is429 ? tModal('rate_limit') : tModal('invalid_password'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleted = () => {
        setShowModal(false);
        toast.success(tModal('deleted'));
        router.push(`/${locale}/auth/signin`);
    };

    const resendDisabled = loading || cooldownSec > 0;

    return (
        <section className="rounded-lg border border-destructive/30 bg-card p-6">
            <h2 className="text-foreground text-lg font-semibold">
                {t('heading')}
            </h2>

            <div className="mt-5">
                <h3 className="text-foreground text-sm font-medium">
                    {t('delete_title')}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                    {t('delete_description')}
                </p>

                {isPendingDeletion && (
                    <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-4">
                        <p className="text-primary text-sm font-medium">
                            {tModal('magic_link_sent_title')}
                        </p>
                        <p className="text-primary mt-1 text-sm">
                            {tModal('magic_link_sent_description')}
                        </p>
                    </div>
                )}

                <UiButton
                    variant="destructive-outline"
                    size="md"
                    className="mt-4 rounded-lg"
                    onClick={() => void handleDelete()}
                    disabled={isPendingDeletion ? resendDisabled : loading}
                >
                    {isPendingDeletion
                        ? cooldownSec > 0
                            ? t('resend_button_cooldown', {
                                  seconds: cooldownSec,
                              })
                            : t('resend_button')
                        : t('delete_button')}
                </UiButton>
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
