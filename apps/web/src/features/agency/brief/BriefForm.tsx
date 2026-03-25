'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import {
    SubmitBriefSchema,
    BRIEF_BUDGET,
    BRIEF_DEADLINE,
} from '@cyanship/types';

import UiButton from '@/shared/ui/UiButton';
import UiInput from '@/shared/ui/UiInput';
import UiTextarea from '@/shared/ui/UiTextarea';
import UiSelect from '@/shared/ui/UiSelect';
import { submitBrief } from '@/shared/api/agency';
import { getApiMessageKey } from '@/shared/api/mapApiCode';
import { getSource } from './lib/source';
import { useTurnstile } from './lib/useTurnstile';

interface BriefFormProps {
    onSuccess: () => void;
}

export default function BriefForm({ onSuccess }: BriefFormProps) {
    const t = useTranslations('brief_form');
    const tGlobal = useTranslations();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [deadline, setDeadline] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { containerRef, token, reset: resetTurnstile } = useTurnstile();

    const budgetOptions = [
        { value: BRIEF_BUDGET.UNDER_2500, label: t('budget_under_2500') },
        {
            value: BRIEF_BUDGET.FROM_2500_TO_5000,
            label: t('budget_2500_5000'),
        },
        {
            value: BRIEF_BUDGET.FROM_5000_TO_10000,
            label: t('budget_5000_10000'),
        },
        { value: BRIEF_BUDGET.OVER_10000, label: t('budget_over_10000') },
    ];

    const deadlineOptions = [
        { value: BRIEF_DEADLINE.ASAP, label: t('deadline_asap') },
        {
            value: BRIEF_DEADLINE.ONE_TO_THREE_MONTHS,
            label: t('deadline_1_3_months'),
        },
        { value: BRIEF_DEADLINE.FLEXIBLE, label: t('deadline_flexible') },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        if (!token) {
            toast.error(t('captcha_not_ready'));
            return;
        }

        const payload = {
            name,
            email,
            description,
            budget,
            ...(deadline && { deadline }),
            source: getSource(),
            lang: navigator.language.slice(0, 5),
            captchaToken: token,
        };

        const result = SubmitBriefSchema.safeParse(payload);
        if (!result.success) {
            const fieldErrors: Record<string, string> = {};
            result.error.issues.forEach((issue) => {
                const field = issue.path[0]?.toString();
                if (field) fieldErrors[field] = t(`validation_${field}`);
            });
            setErrors(fieldErrors);
            return;
        }

        setLoading(true);
        try {
            const { code } = await submitBrief(result.data);
            const messageKey = getApiMessageKey(code, 'agency');
            toast.success(tGlobal(messageKey));
            onSuccess();
        } catch (err) {
            resetTurnstile();
            const code =
                err instanceof AxiosError
                    ? err.response?.data?.error?.code
                    : undefined;
            if (code) {
                const messageKey = getApiMessageKey(code, 'agency');
                toast.error(tGlobal(messageKey));
            } else {
                toast.error(tGlobal('errors.generic.unknown'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <UiInput
                label={t('name_label')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('name_placeholder')}
                error={errors.name}
                disabled={loading}
                required
            />
            <UiInput
                label={t('email_label')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('email_placeholder')}
                error={errors.email}
                disabled={loading}
                required
            />
            <UiTextarea
                label={t('description_label')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('description_placeholder')}
                rows={4}
                error={errors.description}
                disabled={loading}
                required
            />
            <UiSelect
                label={t('budget_label')}
                options={budgetOptions}
                value={budget}
                onChange={setBudget}
                placeholder={t('budget_placeholder')}
                variant="outlined"
                required
            />
            {errors.budget && (
                <p className="text-sm text-destructive">{errors.budget}</p>
            )}
            <UiSelect
                label={t('deadline_label')}
                options={deadlineOptions}
                value={deadline}
                onChange={setDeadline}
                placeholder={t('deadline_placeholder')}
                variant="outlined"
            />

            {/* Turnstile invisible container */}
            <div ref={containerRef} />

            <UiButton
                type="submit"
                variant="filled"
                size="lg"
                disabled={loading}
                className="mt-2 w-full font-semibold"
            >
                {loading ? t('submitting') : t('submit')}
            </UiButton>
        </form>
    );
}
