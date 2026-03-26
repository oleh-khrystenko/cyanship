'use client';

import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth';

export default function DashboardPage() {
    const t = useTranslations('dashboard_page');
    const user = useAuthStore((s) => s.user);

    if (!user) return null;

    return (
        <main className="mx-auto max-w-3xl px-4 py-12">
            <h1 className="text-foreground text-3xl font-bold tracking-tight">
                {t('greeting', { name: user.profile.firstName ?? '' })}
            </h1>
        </main>
    );
}
