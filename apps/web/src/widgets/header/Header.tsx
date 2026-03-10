'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import ChangeLang from '@/features/change-lang';

const ChangeTheme = dynamic(() => import('@/features/change-theme'), {
    ssr: false,
});
import { Logo } from '@/entities/brand';
import UiButton from '@/shared/ui/UiButton';
import UiDropdownMenu from '@/shared/ui/UiDropdownMenu';
import { logout } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

const landingNavItems = [
    { key: 'approach', href: '#problem' },
    { key: 'proof', href: '#dogfooding' },
    { key: 'portfolio', href: '#portfolio' },
    { key: 'workflow', href: '#workflow' },
    { key: 'pricing', href: '#pricing' },
    { key: 'get_started', href: '#footer-cta' },
] as const;

const sectionIds = landingNavItems.map((item) => item.href.slice(1));

function useActiveSection(enabled: boolean) {
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

                if (visible.length > 0) {
                    setActiveId(visible[0].target.id);
                }
            },
            { rootMargin: '-20% 0px -60% 0px' }
        );

        const elements = sectionIds
            .map((id) => document.getElementById(id))
            .filter(Boolean) as HTMLElement[];

        elements.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, [enabled]);

    return activeId;
}

const Header = () => {
    const t = useTranslations('components.header');
    const tNav = useTranslations('landing_page.nav');
    const locale = useLocale();
    const pathname = usePathname();
    const user = useAuthStore((s) => s.user);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isLoading = useAuthStore((s) => s.isLoading);
    const clearUser = useAuthStore((s) => s.clearUser);

    const router = useRouter();
    const isLandingPage = pathname === `/${locale}`;
    const activeSection = useActiveSection(isLandingPage);

    const handleLogout = async () => {
        await logout();
        clearUser();
        window.location.assign(`/${locale}`);
    };

    const userMenuItems = [
        {
            value: 'profile',
            label: t('profile'),
            icon: <User />,
        },
        {
            value: 'logout',
            label: t('logout'),
            icon: <LogOut />,
        },
    ];

    const handleUserMenuSelect = (value: string) => {
        if (value === 'profile') {
            router.push(`/${locale}/profile`);
        } else if (value === 'logout') {
            void handleLogout();
        }
    };

    return (
        <header className="bg-background sticky top-0 z-50 shadow-sm">
            <div className="container flex items-center justify-between gap-6 py-4">
                <UiButton
                    as="link"
                    href={`/${locale}`}
                    variant="text"
                    size="md"
                    aria-label="Go to home page"
                    className="p-0"
                >
                    <Logo />
                </UiButton>

                {isLandingPage && (
                    <nav className="hidden gap-6 md:flex">
                        {landingNavItems.map(({ key, href }) => {
                            const isActive = activeSection === href.slice(1);
                            return (
                                <a
                                    key={key}
                                    href={href}
                                    className={`text-sm transition-colors ${
                                        isActive
                                            ? 'text-foreground font-medium'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {tNav(key)}
                                </a>
                            );
                        })}
                    </nav>
                )}

                <div className="flex items-center gap-4">
                    <ChangeLang />
                    <ChangeTheme />

                    {isLoading ? (
                        <div className="bg-secondary h-8 w-20 animate-pulse rounded-lg" />
                    ) : isAuthenticated && user ? (
                        <>
                            <span className="bg-secondary text-foreground rounded-full px-2.5 py-1 text-xs font-medium">
                                {user.credits.balance}{' '}
                                {t('credits')}
                            </span>
                            <UiDropdownMenu
                                items={userMenuItems}
                                onSelect={handleUserMenuSelect}
                                size="sm"
                                trigger={
                                    <button
                                        type="button"
                                        className="cursor-pointer rounded-full transition-opacity hover:opacity-80"
                                    >
                                        {user.profile.avatar ? (
                                            <Image
                                                src={user.profile.avatar}
                                                alt={
                                                    user.profile.name || ''
                                                }
                                                width={32}
                                                height={32}
                                                className="rounded-full"
                                            />
                                        ) : (
                                            <div className="bg-secondary text-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
                                                {(
                                                    user.profile.name ||
                                                    user.email
                                                )[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </button>
                                }
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
                </div>
            </div>
        </header>
    );
};

export default Header;
