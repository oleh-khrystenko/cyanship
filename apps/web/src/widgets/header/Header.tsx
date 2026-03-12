'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, User, CreditCard, Menu } from 'lucide-react';
import ChangeLang from '@/features/change-lang';

const ChangeTheme = dynamic(() => import('@/features/change-theme'), {
    ssr: false,
});
import { Logo } from '@/entities/brand';
import UiButton from '@/shared/ui/UiButton';
import UiDropdownMenu from '@/shared/ui/UiDropdownMenu';
import { UiAvatar, UiAvatarImage, UiAvatarFallback } from '@/shared/ui/UiAvatar';
import {
    UiSheet,
    UiSheetTrigger,
    UiSheetContent,
    UiSheetHeader,
    UiSheetTitle,
} from '@/shared/ui/UiSheet';
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
                    .sort(
                        (a, b) =>
                            a.boundingClientRect.top -
                            b.boundingClientRect.top
                    );

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

function getInitials(name: string | undefined, email: string): string {
    if (name) {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }
    return email[0]?.toUpperCase() ?? '';
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
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        clearUser();
        setIsSheetOpen(false);
        window.location.assign(`/${locale}`);
    };

    const userMenuItems = [
        {
            value: 'profile',
            label: t('profile'),
            icon: <User />,
        },
        {
            value: 'credits',
            label: `${user?.credits.balance ?? 0} ${t('credits')}`,
            icon: <CreditCard />,
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
        } else if (value === 'credits') {
            router.push(`/${locale}/billing`);
        } else if (value === 'logout') {
            void handleLogout();
        }
    };

    const initials = user
        ? getInitials(user.profile.name, user.email)
        : '';

    return (
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
            <div className="container flex h-16 items-center justify-between gap-6 px-6">
                {/* Logo */}
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

                {/* Desktop nav */}
                {isLandingPage && (
                    <nav className="hidden items-center gap-8 md:flex">
                        {landingNavItems.map(({ key, href }) => {
                            const isActive =
                                activeSection === href.slice(1);
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

                {/* Desktop right side */}
                <div className="hidden items-center gap-2 md:flex">
                    <ChangeLang />
                    <ChangeTheme />

                    {isLoading ? (
                        <div className="bg-secondary h-8 w-20 animate-pulse rounded-lg" />
                    ) : isAuthenticated && user ? (
                        <UiDropdownMenu
                            items={userMenuItems}
                            onSelect={handleUserMenuSelect}
                            size="sm"
                            trigger={
                                <button
                                    type="button"
                                    className="cursor-pointer rounded-full transition-opacity hover:opacity-80"
                                >
                                    <UiAvatar size="sm">
                                        <UiAvatarImage
                                            src={
                                                user.profile.avatar ??
                                                undefined
                                            }
                                            alt={
                                                user.profile.name ?? ''
                                            }
                                        />
                                        <UiAvatarFallback size="sm">
                                            {initials}
                                        </UiAvatarFallback>
                                    </UiAvatar>
                                </button>
                            }
                        />
                    ) : (
                        <UiButton
                            as="link"
                            href={`/${locale}/auth/signin`}
                            variant="text"
                            size="sm"
                        >
                            {t('signin')}
                        </UiButton>
                    )}

                    {isLandingPage && (
                        <UiButton
                            as="a"
                            href="#footer-cta"
                            variant="filled"
                            size="sm"
                            className="rounded-lg"
                        >
                            {t('get_started')}
                        </UiButton>
                    )}
                </div>

                {/* Mobile hamburger */}
                <div className="md:hidden">
                    <UiSheet
                        open={isSheetOpen}
                        onOpenChange={setIsSheetOpen}
                    >
                        <UiSheetTrigger asChild>
                            <UiButton
                                variant="icon"
                                size="md"
                                aria-label={t('menu')}
                                IconLeft={<Menu />}
                            />
                        </UiSheetTrigger>
                        <UiSheetContent side="right" className="w-80">
                            <UiSheetHeader>
                                <UiSheetTitle className="text-left">
                                    LucidShip
                                </UiSheetTitle>
                            </UiSheetHeader>

                            <div className="flex flex-col gap-6 px-4 py-2">
                                {/* Mobile nav */}
                                {isLandingPage && (
                                    <nav className="flex flex-col gap-4">
                                        {landingNavItems.map(
                                            ({ key, href }) => (
                                                <a
                                                    key={key}
                                                    href={href}
                                                    className="text-muted-foreground hover:text-foreground py-2 text-sm transition-colors"
                                                    onClick={() =>
                                                        setIsSheetOpen(
                                                            false
                                                        )
                                                    }
                                                >
                                                    {tNav(key)}
                                                </a>
                                            )
                                        )}
                                    </nav>
                                )}

                                {isLandingPage && (
                                    <div className="bg-border h-px" />
                                )}

                                {/* Mobile settings */}
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-sm">
                                        {t('settings')}:
                                    </span>
                                    <ChangeLang />
                                    <ChangeTheme />
                                </div>

                                <div className="bg-border h-px" />

                                {/* Mobile auth */}
                                {isLoading ? (
                                    <div className="bg-secondary h-10 w-full animate-pulse rounded-lg" />
                                ) : isAuthenticated && user ? (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center gap-3">
                                            <UiAvatar size="md">
                                                <UiAvatarImage
                                                    src={
                                                        user.profile
                                                            .avatar ??
                                                        undefined
                                                    }
                                                    alt={
                                                        user.profile
                                                            .name ?? ''
                                                    }
                                                />
                                                <UiAvatarFallback size="md">
                                                    {initials}
                                                </UiAvatarFallback>
                                            </UiAvatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">
                                                    {user.profile.name}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {user.email}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-foreground flex items-center gap-2 py-2 text-sm transition-colors"
                                            onClick={() => {
                                                setIsSheetOpen(false);
                                                router.push(
                                                    `/${locale}/billing`
                                                );
                                            }}
                                        >
                                            <CreditCard className="size-4" />
                                            <span>
                                                {user.credits.balance}{' '}
                                                {t('credits')}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-foreground flex items-center gap-2 py-2 text-sm transition-colors"
                                            onClick={() => {
                                                setIsSheetOpen(false);
                                                router.push(
                                                    `/${locale}/profile`
                                                );
                                            }}
                                        >
                                            <User className="size-4" />
                                            <span>{t('profile')}</span>
                                        </button>

                                        <button
                                            type="button"
                                            className="text-destructive hover:text-destructive/80 flex items-center gap-2 py-2 text-sm transition-colors"
                                            onClick={() =>
                                                void handleLogout()
                                            }
                                        >
                                            <LogOut className="size-4" />
                                            <span>{t('logout')}</span>
                                        </button>
                                    </div>
                                ) : (
                                    <UiButton
                                        as="link"
                                        href={`/${locale}/auth/signin`}
                                        variant="text"
                                        size="sm"
                                        className="justify-start"
                                        onClick={() =>
                                            setIsSheetOpen(false)
                                        }
                                    >
                                        {t('signin')}
                                    </UiButton>
                                )}

                                {/* Mobile CTA */}
                                {isLandingPage && (
                                    <UiButton
                                        as="a"
                                        href="#footer-cta"
                                        variant="filled"
                                        size="md"
                                        className="mt-2 w-full rounded-lg"
                                        onClick={() =>
                                            setIsSheetOpen(false)
                                        }
                                    >
                                        {t('get_started')}
                                    </UiButton>
                                )}
                            </div>
                        </UiSheetContent>
                    </UiSheet>
                </div>
            </div>
        </header>
    );
};

export default Header;
