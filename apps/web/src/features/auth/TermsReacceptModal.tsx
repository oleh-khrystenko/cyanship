'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CURRENT_TERMS_VERSION } from '@cyanship/types';

import UiButton from '@/shared/ui/UiButton';
import UiCheckbox from '@/shared/ui/UiCheckbox';
import UiSpinner from '@/shared/ui/UiSpinner';
import { acceptTerms } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

interface Props {
    open: boolean;
    onAccepted: () => void;
}

export function TermsReacceptModal({ open, onAccepted }: Props) {
    const t = useTranslations('components.terms_reaccept');
    const locale = useLocale();
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const handleSubmit = async () => {
        if (!agreed) {
            setError(t('required'));
            return;
        }
        setSubmitting(true);
        try {
            await acceptTerms();
            const store = useAuthStore.getState();
            if (store.user) {
                store.setUser({ ...store.user, termsVersion: CURRENT_TERMS_VERSION });
            }
            onAccepted();
        } catch {
            setError(t('error'));
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card mx-4 max-w-md rounded-xl p-8 shadow-xl space-y-6">
                <h2 className="text-foreground text-xl font-bold">
                    {t('title')}
                </h2>
                <p className="text-muted-foreground text-sm">
                    {t('description')}
                </p>

                <UiCheckbox
                    checked={agreed}
                    onChange={(v) => {
                        setAgreed(v);
                        if (v) setError('');
                    }}
                    error={error}
                >
                    {t.rich('agree', {
                        terms: (chunks) => (
                            <a
                                href={`/${locale}/terms`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline hover:no-underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {chunks}
                            </a>
                        ),
                        privacy: (chunks) => (
                            <a
                                href={`/${locale}/privacy`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline hover:no-underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {chunks}
                            </a>
                        ),
                    })}
                </UiCheckbox>

                <UiButton
                    variant="filled"
                    size="lg"
                    className="w-full justify-center"
                    disabled={submitting}
                    onClick={handleSubmit}
                >
                    {submitting ? <UiSpinner size="sm" /> : t('button')}
                </UiButton>
            </div>
        </div>
    );
}
