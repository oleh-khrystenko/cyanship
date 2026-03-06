'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import UiFullPageLoader from '@/shared/ui/UiFullPageLoader';
import { useAuthStore } from '@/stores/auth';
import {
    ProfileForm,
    SecuritySection,
    DangerZone,
} from '@/features/profile';
import type { ProfileMode } from '@/features/profile';

function ProfileContent() {
    const searchParams = useSearchParams();
    const mode = (searchParams.get('mode') as ProfileMode) ?? null;
    const t = useTranslations('profile_page');
    const locale = useLocale();
    const router = useRouter();
    const user = useAuthStore((s) => s.user);

    if (!user) return null;

    const handleProfileSaved = () => {
        if (mode === 'new') {
            router.push(`/${locale}/profile`);
        }
    };

    return (
        <main className="mx-auto max-w-xl px-4 py-10">
            <h1 className="text-text-primary mb-8 text-3xl font-bold">
                {mode === 'new' ? t('new_heading') : t('heading')}
            </h1>

            <div className="space-y-10">
                <ProfileForm
                    user={user}
                    editable={mode === 'new' || mode === null}
                    nameRequired={mode === 'new'}
                    onSaved={handleProfileSaved}
                />

                <SecuritySection user={user} mode={mode} />

                {mode === null && <DangerZone />}
            </div>
        </main>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<UiFullPageLoader />}>
            <ProfileContent />
        </Suspense>
    );
}
