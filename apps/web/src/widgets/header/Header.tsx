'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
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
import { useHeaderNavStore } from '@/stores/headerNav';

function useActiveSection(sectionIds: string[]) {
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        if (sectionIds.length === 0) return;

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
    }, [sectionIds]);

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
    const locale = useLocale();
    const user = useAuthStore((s) => s.user);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isLoading = useAuthStore((s) => s.isLoading);
    const clearUser = useAuthStore((s) => s.clearUser);
    const navItems = useHeaderNavStore((s) => s.navItems);
    const cta = useHeaderNavStore((s) => s.cta);

    const router = useRouter();
    const pathname = usePathname();
    const isSigninPage = pathname.endsWith('/auth/signin');
    const hasNav = navItems.length > 0;
    const sectionIds = useMemo(
        () => navItems.map((item) => item.href.replace('#', '')),
        [navItems]
    );
    const activeSection = useActiveSection(sectionIds);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        clearUser();
        setIsSheetOpen(false);
        window.location.assign(`/${locale}`);
    };

    const formattedExecutions = (user?.executions.balance ?? 0).toLocaleString('en-US');

    const allUserMenuItems: {
        value: string;
        label: string;
        icon: React.ReactNode;
        route?: string;
        badge?: string;
    }[] = [
        {
            value: 'profile',
            label: t('profile'),
            icon: <User />,
            route: `/${locale}/profile`,
        },
        {
            value: 'billing',
            label: t('billing'),
            icon: <CreditCard />,
            route: `/${locale}/billing`,
            badge: formattedExecutions,
        },
        {
            value: 'logout',
            label: t('logout'),
            icon: <LogOut />,
        },
    ];

    const userMenuItems = allUserMenuItems.filter(
        (item) => !item.route || !pathname.startsWith(item.route)
    );

    const handleUserMenuSelect = (value: string) => {
        const item = allUserMenuItems.find((i) => i.value === value);
        if (item?.route) {
            router.push(item.route);
        } else if (value === 'logout') {
            void handleLogout();
        }
    };

    const initials = user
        ? getInitials(user.profile.name, user.email)
        : '';

    return (
        <header className="liquid-glass sticky top-0 z-50 border-b border-b-liquid-glass-border">
            <div className="container flex h-16 items-center justify-between gap-6 px-6">
                {/* Logo — on landing: smooth scroll to top, elsewhere: navigate home */}
                {hasNav ? (
                    <UiButton
                        as="button"
                        variant="text"
                        size="md"
                        aria-label="Go to home page"
                        className="p-0"
                        onClick={() => {
                            window.scrollTo({
                                top: 0,
                                behavior: 'smooth',
                            });
                            history.replaceState(
                                null,
                                '',
                                window.location.pathname
                            );
                        }}
                    >
                        <Logo />
                    </UiButton>
                ) : (
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
                )}

                {/* Desktop nav */}
                {hasNav && (
                    <nav className="hidden items-center gap-8 lg:flex">
                        {navItems.map(({ href, label }) => {
                            const isActive =
                                activeSection === href.replace('#', '');
                            return (
                                <a
                                    key={href}
                                    href={href}
                                    className={`text-sm transition-colors ${
                                        isActive
                                            ? 'text-foreground font-medium'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {label}
                                </a>
                            );
                        })}
                    </nav>
                )}

                {/* Desktop right side */}
                <div className="hidden items-center gap-2 lg:flex">
                    <ChangeLang />
                    <ChangeTheme />

                    {isLoading ? (
                        <div className="bg-secondary h-8 w-20 animate-pulse rounded-lg" />
                    ) : isAuthenticated && user ? (
                        <UiDropdownMenu
                            items={userMenuItems}
                            onSelect={handleUserMenuSelect}
                            size="sm"
                            header={
                                <div className="flex items-center gap-2.5">
                                    <UiAvatar size="sm">
                                        <UiAvatarImage
                                            src={user.profile.avatar ?? undefined}
                                            alt={user.profile.name ?? ''}
                                        />
                                        <UiAvatarFallback size="sm">
                                            {initials}
                                        </UiAvatarFallback>
                                    </UiAvatar>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-foreground">
                                            {user.profile.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {user.email}
                                        </span>
                                    </div>
                                </div>
                            }
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
                        !isSigninPage && (
                            <UiButton
                                as="link"
                                href={`/${locale}/auth/signin`}
                                variant="text"
                                size="sm"
                            >
                                {t('signin')}
                            </UiButton>
                        )
                    )}

                    {cta && (
                        <UiButton
                            as="a"
                            href={cta.href}
                            variant="filled"
                            size="sm"
                            className="ml-2"
                        >
                            {cta.label}
                        </UiButton>
                    )}
                </div>

                {/* Mobile hamburger */}
                <div className="lg:hidden">
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
                                    CyanShip
                                </UiSheetTitle>
                            </UiSheetHeader>

                            <div className="flex flex-col gap-6 px-4 py-2">
                                {/* Mobile nav */}
                                {hasNav && (
                                    <nav className="flex flex-col gap-4">
                                        {navItems.map(
                                            ({ href, label }) => (
                                                <a
                                                    key={href}
                                                    href={href}
                                                    className="text-muted-foreground hover:text-foreground py-2 text-sm transition-colors"
                                                    onClick={() =>
                                                        setIsSheetOpen(
                                                            false
                                                        )
                                                    }
                                                >
                                                    {label}
                                                </a>
                                            )
                                        )}
                                    </nav>
                                )}

                                {hasNav && (
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

                                        {userMenuItems.map((item) => (
                                            <button
                                                key={item.value}
                                                type="button"
                                                className={`flex items-center gap-2 py-2 text-sm transition-colors ${
                                                    item.value === 'logout'
                                                        ? 'text-destructive hover:text-destructive/80'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                                onClick={() => {
                                                    setIsSheetOpen(false);
                                                    handleUserMenuSelect(
                                                        item.value
                                                    );
                                                }}
                                            >
                                                <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
                                                    {item.icon}
                                                </span>
                                                <span>{item.label}</span>
                                                {item.badge != null && (
                                                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs leading-none text-muted-foreground">
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    !isSigninPage && (
                                        <UiButton
                                            as="link"
                                            href={`/${locale}/auth/signin`}
                                            variant="text"
                                            size="md"
                                            className="justify-start"
                                            onClick={() =>
                                                setIsSheetOpen(false)
                                            }
                                        >
                                            {t('signin')}
                                        </UiButton>
                                    )
                                )}

                                {/* Mobile CTA */}
                                {cta && (
                                    <UiButton
                                        as="a"
                                        href={cta.href}
                                        variant="filled"
                                        size="md"
                                        className="mt-2 w-full"
                                        onClick={() =>
                                            setIsSheetOpen(false)
                                        }
                                    >
                                        {cta.label}
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
