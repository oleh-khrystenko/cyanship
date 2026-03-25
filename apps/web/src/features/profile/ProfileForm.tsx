'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { nameSchema } from '@cyanship/types';
import type { UserProfile } from '@cyanship/types';
import UiButton from '@/shared/ui/UiButton';
import UiInput from '@/shared/ui/UiInput';
import UiSpinner from '@/shared/ui/UiSpinner';
import { updateProfile, getMe } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

const ProfileFormSchema = z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim(),
});

type ProfileFormValues = z.input<typeof ProfileFormSchema>;

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

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(ProfileFormSchema),
        mode: 'onTouched',
        defaultValues: {
            firstName: parsed.firstName,
            lastName: parsed.lastName,
        },
    });

    const { errors, isSubmitting, isDirty } = form.formState;

    const clearNameValidationError = () => {
        if (errors.firstName?.type === 'validate') {
            form.clearErrors('firstName');
        }
    };

    const onSubmit = async (data: ProfileFormValues) => {
        const fullName = combineName(data.firstName, data.lastName);
        const nameResult = nameSchema.safeParse(fullName);

        if (!nameResult.success) {
            const code = nameResult.error.issues[0]?.code;
            const message = code === 'too_small'
                ? t('name_too_short')
                : t('name_invalid_chars');
            form.setError('firstName', { type: 'validate', message });
            return;
        }

        try {
            await updateProfile({ name: fullName });
            const me = await getMe();
            setUser(me);
            const newParsed = parseName(me.profile.name);
            form.reset({
                firstName: newParsed.firstName,
                lastName: newParsed.lastName,
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

    return (
        <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-foreground text-lg font-semibold">
                {t('heading')}
            </h2>

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
                        {...form.register('firstName', {
                            onChange: clearNameValidationError,
                        })}
                        type="text"
                        placeholder={t('name_placeholder')}
                        error={
                            errors.firstName?.type === 'validate'
                                ? errors.firstName.message
                                : errors.firstName
                                    ? t('name_required')
                                    : undefined
                        }
                        disabled={!editable}
                        size="lg"
                    />
                </div>

                <div>
                    <label className="text-muted-foreground mb-1.5 block text-sm">
                        {t('last_name_label')}
                    </label>
                    <UiInput
                        {...form.register('lastName', {
                            onChange: clearNameValidationError,
                        })}
                        type="text"
                        placeholder={t('last_name_placeholder')}
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
        </section>
    );
};

export default ProfileForm;
