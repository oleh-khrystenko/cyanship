'use client';

import { FormEvent, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Lang, UserProfile } from '@lucidkit/types';
import UiButton from '@/shared/ui/UiButton';
import UiInput from '@/shared/ui/UiInput';
import UiSelect from '@/shared/ui/UiSelect';
import UiSpinner from '@/shared/ui/UiSpinner';
import { updateProfile, getMe } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

interface ProfileFormProps {
    user: UserProfile;
    editable: boolean;
    nameRequired: boolean;
    onSaved?: () => void;
}

const LANG_OPTIONS = [
    { value: 'uk', label: 'Українська' },
    { value: 'en', label: 'English' },
];

const ProfileForm = ({
    user,
    editable,
    nameRequired,
    onSaved,
}: ProfileFormProps) => {
    const t = useTranslations('profile_page.form');
    const locale = useLocale();
    const setUser = useAuthStore((s) => s.setUser);

    const [name, setName] = useState(user.profile.name ?? '');
    const [avatar, setAvatar] = useState(user.profile.avatar ?? '');
    const [lang, setLang] = useState<Lang>(
        (user.preferredLang as Lang) ?? (locale as Lang)
    );
    const [submitting, setSubmitting] = useState(false);
    const [nameError, setNameError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (nameRequired && !name.trim()) {
            setNameError(t('name_required'));
            return;
        }

        setSubmitting(true);
        setNameError('');

        try {
            await updateProfile({
                name: name.trim() || undefined,
                avatar: avatar.trim() || undefined,
                preferredLang: lang,
            });
            const me = await getMe();
            setUser(me);
            toast.success(t('saved'));
            onSaved?.();
        } catch {
            toast.error(t('saved'));
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
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        if (nameError) setNameError('');
                    }}
                    error={nameError || undefined}
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

            <div>
                <label className="text-text-secondary mb-1 block text-sm">
                    {t('language_label')}
                </label>
                <UiSelect
                    options={LANG_OPTIONS}
                    value={lang}
                    onChange={(v: string) => setLang(v as Lang)}
                    disabled={!editable}
                    variant="outlined"
                    size="lg"
                    className="w-full rounded-md"
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
