'use client';

import { useTranslations } from 'next-intl';
import { getFullName, getInitials } from '@cyanship/types';
import { useAuthStore } from '@/stores/auth';
import {
    UiAvatar,
    UiAvatarImage,
    UiAvatarFallback,
} from '@/shared/ui/UiAvatar';

export default function DashboardPage() {
    const t = useTranslations('dashboard_page');
    const user = useAuthStore((s) => s.user);

    if (!user) return null;

    const fullName = getFullName(user.profile.firstName, user.profile.lastName);
    const initials = getInitials(fullName, user.email);

    return (
        <main className="mx-auto max-w-3xl px-4 py-12 md:py-16">
            <div className="flex items-center gap-4">
                <UiAvatar size="xl">
                    <UiAvatarImage
                        src={user.profile.avatar ?? undefined}
                        alt={fullName}
                    />
                    <UiAvatarFallback size="xl">
                        {initials}
                    </UiAvatarFallback>
                </UiAvatar>
                <div className="flex flex-col gap-0.5">
                    <h1 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
                        {t('greeting', {
                            name: user.profile.firstName ?? '',
                        })}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {user.email}
                    </p>
                </div>
            </div>
        </main>
    );
}
