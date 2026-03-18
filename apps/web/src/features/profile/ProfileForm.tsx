'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { UserProfile } from '@cyanship/types';
import UiButton from '@/shared/ui/UiButton';
import UiInput from '@/shared/ui/UiInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import { updateProfile, getMe } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

interface ProfileFormProps {
    user: UserProfile;
    editable: boolean;
    onSaved?: () => void;
}

function parseName(fullName?: string): { firstName: string; lastName: string } {
    if (!fullName) return { firstName: '', lastName: '' };
    const parts = fullName.trim().split(/\s+/);
    return {
        firstName: parts[0] ?? '',
        lastName: parts.slice(1).join(' '),
    };
}

function combineName(firstName: string, lastName: string): string {
    return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
}

const ProfileForm = ({
    user,
    editable,
    onSaved,
}: ProfileFormProps) => {
    const t = useTranslations('profile_page.form');
    const setUser = useAuthStore((s) => s.setUser);

    const parsed = parseName(user.profile.name);

    const [firstName, setFirstName] = useState(parsed.firstName);
    const [lastName, setLastName] = useState(parsed.lastName);
    const [submitting, setSubmitting] = useState(false);
    const [nameError, setNameError] = useState('');

    const isDirty =
        firstName.trim() !== parsed.firstName ||
        lastName.trim() !== parsed.lastName;

    const handleCancel = () => {
        setFirstName(parsed.firstName);
        setLastName(parsed.lastName);
        setNameError('');
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const namePattern = /^[\p{L}\s'\-]+$/u;
        const trimmedFirst = firstName.trim();

        if (!trimmedFirst) {
            setNameError(t('name_required'));
            return;
        }

        const fullName = combineName(firstName, lastName);

        if (fullName.length < 2) {
            setNameError(t('name_too_short'));
            return;
        }

        if (!namePattern.test(fullName)) {
            setNameError(t('name_invalid_chars'));
            return;
        }

        setSubmitting(true);
        setNameError('');

        try {
            await updateProfile({ name: fullName });
            const me = await getMe();
            setUser(me);
            toast.success(t('saved'));
            onSaved?.();
        } catch {
            toast.error(t('save_error'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-foreground text-lg font-semibold">
                {t('heading')}
            </h2>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                    <label className="text-muted-foreground mb-1.5 block text-sm">
                        {t('name_label')}
                        <span className="text-destructive ml-1">*</span>
                    </label>
                    <UiInput
                        type="text"
                        placeholder={t('name_placeholder')}
                        value={firstName}
                        onChange={(e) => {
                            setFirstName(e.target.value);
                            if (nameError) setNameError('');
                        }}
                        error={nameError || undefined}
                        disabled={!editable}
                        size="lg"
                    />
                </div>

                <div>
                    <label className="text-muted-foreground mb-1.5 block text-sm">
                        {t('last_name_label')}
                    </label>
                    <UiInput
                        type="text"
                        placeholder={t('last_name_placeholder')}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={!editable}
                        size="lg"
                    />
                </div>

                {editable && isDirty && (
                    <div className="flex items-center gap-3">
                        <UiButton
                            type="submit"
                            variant="filled"
                            size="md"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <UiSpinner size="sm" />
                            ) : (
                                t('save_button')
                            )}
                        </UiButton>
                        <UiButton
                            type="button"
                            variant="text"
                            size="md"
                            onClick={handleCancel}
                            disabled={submitting}
                        >
                            {t('cancel_button')}
                        </UiButton>
                    </div>
                )}
            </form>
        </section>
    );
};

export default ProfileForm;
