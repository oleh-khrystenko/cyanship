'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import ChangeLang from '@/features/change-lang';

const ChangeTheme = dynamic(() => import('@/features/change-theme'), {
    ssr: false,
});
import { Logo } from '@/entities/brand';
import UiButton from '@/shared/ui/UiButton';
import { logout } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

const Header = () => {
    const t = useTranslations('components.header');
    const locale = useLocale();
    const user = useAuthStore((s) => s.user);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isLoading = useAuthStore((s) => s.isLoading);
    const clearUser = useAuthStore((s) => s.clearUser);

    const handleLogout = async () => {
        await logout();
        clearUser();
        window.location.href = `/${locale}`;
    };

    return (
        <header className="bg-background sticky top-0 z-50 shadow-sm">
            <div className="container flex items-center justify-between gap-6 py-4">
                <Link href={`/${locale}`} aria-label="Go to home page">
                    <Logo />
                </Link>

                <div className="flex items-center gap-4">
                    {isLoading ? (
                        <div className="h-8 w-20 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700" />
                    ) : isAuthenticated && user ? (
                        <>
                            <div className="flex items-center gap-2">
                                {user.profile.avatar ? (
                                    <Image
                                        src={user.profile.avatar}
                                        alt={user.profile.name || ''}
                                        width={32}
                                        height={32}
                                        className="rounded-full"
                                    />
                                ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-300 text-sm font-semibold text-neutral-700 dark:bg-neutral-600 dark:text-neutral-200">
                                        {(user.profile.name ||
                                            user.email)[0]?.toUpperCase()}
                                    </div>
                                )}
                                <span className="text-text-primary hidden text-sm sm:block">
                                    {user.profile.name || user.email}
                                </span>
                                <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                                    {user.credits.balance} {t('credits')}
                                </span>
                            </div>
                            <UiButton
                                variant="icon-compact"
                                size="sm"
                                onClick={() => {
                                    void handleLogout();
                                }}
                                aria-label={t('logout')}
                                IconLeft={LogOut}
                            />
                        </>
                    ) : (
                        <UiButton
                            as="link"
                            href={`/${locale}/auth/signin`}
                            variant="filled"
                            size="sm"
                            className="rounded-lg"
                        >
                            {t('signin')}
                        </UiButton>
                    )}

                    <ChangeTheme />
                    <ChangeLang />
                </div>
            </div>
        </header>
    );
};

export default Header;
