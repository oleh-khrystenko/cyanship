'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { firstNameSchema, lastNameSchema } from '@cyanship/types';
import type { UserProfile } from '@cyanship/types';
import UiButton from '@/shared/ui/UiButton';
import UiInput from '@/shared/ui/UiInput';
import UiSectionCard from '@/shared/ui/UiSectionCard';
import UiSpinner from '@/shared/ui/UiSpinner';
import { getFieldError } from '@/shared/lib';
import { updateProfile, getMe } from '@/shared/api';
import { useAuthStore } from '@/entities/user';

const ProfileFormSchema = z.object({
    firstName: firstNameSchema,
    lastName: z.union([lastNameSchema, z.literal('')]),
});

type ProfileFormValues = z.input<typeof ProfileFormSchema>;

interface ProfileFormProps {
    user: UserProfile;
    editable: boolean;
    onSaved?: () => void;
}

const ProfileForm = ({
    user,
    editable,
    onSaved,
}: ProfileFormProps) => {
    const t = useTranslations('profile_page.form');
    const setUser = useAuthStore((s) => s.setUser);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(ProfileFormSchema),
        mode: 'onTouched',
        defaultValues: {
            firstName: user.profile.firstName ?? '',
            lastName: user.profile.lastName ?? '',
        },
    });

    const { errors, isSubmitting, isDirty } = form.formState;
    const [firstNameValue, lastNameValue] = form.watch([
        'firstName',
        'lastName',
    ]);

    const onSubmit = async (data: ProfileFormValues) => {
        const firstName = data.firstName.trim();
        const lastName = data.lastName.trim();

        try {
            await updateProfile({
                firstName,
                ...(lastName ? { lastName } : { lastName: '' }),
            });
            const me = await getMe();
            setUser(me);
            form.reset({
                firstName: me.profile.firstName ?? '',
                lastName: me.profile.lastName ?? '',
            });
            toast.success(t('saved'));
            onSaved?.();
        } catch {
            toast.error(t('save_error'));
        }
    };

    const handleCancel = () => {
        form.reset();
    };

    const nameMessages = {
        required: t('name_required'),
        too_small: t('name_too_short'),
        too_big: t('name_too_long'),
        invalid_string: t('name_invalid_chars'),
        invalid_format: t('name_invalid_chars'),
    };

    return (
        <UiSectionCard title={t('heading')}>
            <dl className="mt-5">
                <dt className="text-muted-foreground text-sm">
                    {t('email_label')}
                </dt>
                <dd className="mt-1 text-foreground">
                    {user.email}
                </dd>
            </dl>

            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
                <div>
                    <label className="text-muted-foreground mb-1.5 block text-sm">
                        {t('name_label')}
                        <span className="text-destructive ml-1">*</span>
                    </label>
                    <UiInput
                        {...form.register('firstName')}
                        type="text"
                        placeholder={t('name_placeholder')}
                        error={getFieldError(errors.firstName, nameMessages, firstNameValue)}
                        disabled={!editable}
                        size="lg"
                    />
                </div>

                <div>
                    <label className="text-muted-foreground mb-1.5 block text-sm">
                        {t('last_name_label')}
                    </label>
                    <UiInput
                        {...form.register('lastName')}
                        type="text"
                        placeholder={t('last_name_placeholder')}
                        error={getFieldError(errors.lastName, nameMessages, lastNameValue)}
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
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
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
                            disabled={isSubmitting}
                        >
                            {t('cancel_button')}
                        </UiButton>
                    </div>
                )}
            </form>
        </UiSectionCard>
    );
};

export default ProfileForm;
