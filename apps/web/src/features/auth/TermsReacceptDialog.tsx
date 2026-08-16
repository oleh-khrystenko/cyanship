'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CURRENT_TERMS_VERSION } from '@cyanship/types';
import {
    UiModal,
    UiModalContent,
    UiModalHeader,
    UiModalTitle,
} from '@/shared/ui/UiModal';
import UiButton from '@/shared/ui/UiButton';
import UiCheckbox from '@/shared/ui/UiCheckbox';
import UiLink from '@/shared/ui/UiLink';
import UiSpinner from '@/shared/ui/UiSpinner';
import { acceptTerms } from '@/shared/api';
import { signOut, useAuthStore } from '@/entities/user';
import { useTermsReacceptDialogStore } from './termsReacceptDialogStore';

type PendingAction = 'accept' | 'decline' | null;

function TermsReacceptForm({ onClose }: { onClose: () => void }) {
    const t = useTranslations('components.terms_reaccept');
    const tGlobal = useTranslations();
    const locale = useLocale();

    const [agreed, setAgreed] = useState(false);
    const [checkboxError, setCheckboxError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [pending, setPending] = useState<PendingAction>(null);

    const handleSubmit = async () => {
        if (!agreed) {
            setCheckboxError(t('required'));
            return;
        }
        setSubmitError('');
        setPending('accept');
        try {
            await acceptTerms();
            const store = useAuthStore.getState();
            if (store.user) {
                store.setUser({
                    ...store.user,
                    termsVersion: CURRENT_TERMS_VERSION,
                });
            }
            onClose();
        } catch {
            setSubmitError(t('error'));
            setPending(null);
        }
    };

    const handleDecline = async () => {
        setSubmitError('');
        setPending('decline');
        // `signOut` always settles, so a stalled logout cannot trap the user in
        // this dialog (it has no close button, and escape and outside clicks
        // are blocked). It can still fail, and a failed sign-out leaves the
        // session alive — say so rather than closing on a false success.
        const ok = await signOut({ redirectTo: `/${locale}` });
        if (!ok) {
            setSubmitError(tGlobal('errors.auth.logout_failed'));
            setPending(null);
            return;
        }
        onClose();
    };

    return (
        <>
            <UiModalHeader>
                <UiModalTitle>{t('title')}</UiModalTitle>
            </UiModalHeader>
            <div className="space-y-6 px-4 pb-6">
                <p className="text-muted-foreground text-sm">
                    {t('description')}
                </p>

                <UiCheckbox
                    checked={agreed}
                    onChange={(v) => {
                        setAgreed(v);
                        if (v) setCheckboxError('');
                    }}
                    error={checkboxError}
                >
                    {t.rich('agree', {
                        terms: (chunks) => (
                            <UiLink
                                href={`/${locale}/terms`}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="primary-underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {chunks}
                            </UiLink>
                        ),
                        privacy: (chunks) => (
                            <UiLink
                                href={`/${locale}/privacy`}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="primary-underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {chunks}
                            </UiLink>
                        ),
                    })}
                </UiCheckbox>

                <div className="space-y-2">
                    <UiButton
                        variant="filled"
                        size="lg"
                        className="w-full justify-center"
                        disabled={pending !== null}
                        onClick={handleSubmit}
                    >
                        {pending === 'accept' ? (
                            <UiSpinner size="sm" />
                        ) : (
                            t('button')
                        )}
                    </UiButton>

                    <UiButton
                        variant="text"
                        size="lg"
                        className="w-full justify-center"
                        disabled={pending !== null}
                        onClick={handleDecline}
                    >
                        {pending === 'decline' ? (
                            <UiSpinner size="sm" />
                        ) : (
                            t('decline_button')
                        )}
                    </UiButton>

                    {submitError && (
                        <p className="text-destructive text-center text-sm">
                            {submitError}
                        </p>
                    )}
                </div>
            </div>
        </>
    );
}

export default function TermsReacceptDialog() {
    const isOpen = useTermsReacceptDialogStore((s) => s.isOpen);
    const close = useTermsReacceptDialogStore((s) => s.close);

    return (
        <UiModal open={isOpen}>
            <UiModalContent
                hideCloseButton
                onEscapeKeyDown={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                {isOpen && <TermsReacceptForm onClose={close} />}
            </UiModalContent>
        </UiModal>
    );
}
