'use client';

import { FormEvent, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { UserProfile } from '@lucidship/types';
import UiButton from '@/shared/ui/UiButton';
import UiInput from '@/shared/ui/UiInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import { updateProfile, getMe } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

interface ProfileFormProps {
    user: UserProfile;
    editable: boolean;
    nameRequired: boolean;
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
    nameRequired,
    onSaved,
}: ProfileFormProps) => {
    const t = useTranslations('profile_page.form');
    const setUser = useAuthStore((s) => s.setUser);

    const parsed = parseName(user.profile.name);
    const [firstName, setFirstName] = useState(parsed.firstName);
    const [lastName, setLastName] = useState(parsed.lastName);
    const [avatar, setAvatar] = useState(user.profile.avatar ?? '');
    const [submitting, setSubmitting] = useState(false);
    const [nameError, setNameError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (nameRequired && !firstName.trim()) {
            setNameError(t('name_required'));
            return;
        }

        setSubmitting(true);
        setNameError('');

        try {
            const fullName = combineName(firstName, lastName);
            await updateProfile({
                name: fullName || undefined,
                avatar: avatar.trim() || undefined,
            });
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
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="text-text-secondary mb-1 block text-sm">
                    {t('name_label')}
                    {nameRequired && (
                        <span className="text-error ml-1">*</span>
                    )}
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
                <label className="text-text-secondary mb-1 block text-sm">
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

            <div>
                <label className="text-text-secondary mb-1 block text-sm">
                    {t('avatar_label')}
                </label>
                <UiInput
                    type="url"
                    placeholder={t('avatar_placeholder')}
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    disabled={!editable}
                    size="lg"
                />
            </div>

            {editable && (
                <UiButton
                    type="submit"
                    variant="filled"
                    size="lg"
                    className="w-full justify-center rounded-lg"
                    disabled={submitting}
                >
                    {submitting ? (
                        <UiSpinner size="sm" />
                    ) : (
                        t('save_button')
                    )}
                </UiButton>
            )}
        </form>
    );
};

export default ProfileForm;
