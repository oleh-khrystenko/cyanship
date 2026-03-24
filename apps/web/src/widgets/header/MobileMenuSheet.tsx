'use client';

import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { LogOut, User, CreditCard } from 'lucide-react';
import ChangeLang from '@/features/change-lang';

const ChangeTheme = dynamic(() => import('@/features/change-theme'), {
    ssr: false,
});
import UiButton from '@/shared/ui/UiButton';
import { UiAvatar, UiAvatarImage, UiAvatarFallback } from '@/shared/ui/UiAvatar';
import {
    UiSheet,
    UiSheetContent,
    UiSheetHeader,
    UiSheetTitle,
} from '@/shared/ui/UiSheet';
import { useAuthStore } from '@/stores/auth';
import { useHeaderNavStore } from '@/stores/headerNav';
import { useMobileMenuSheetStore } from '@/stores/mobileMenuSheet';
import { useUserMenu } from './useUserMenu';

export default function MobileMenuSheet() {
    const t = useTranslations('components.header');
    const locale = useLocale();
    const pathname = usePathname();

    const user = useAuthStore((s) => s.user);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isLoading = useAuthStore((s) => s.isLoading);
    const navItems = useHeaderNavStore((s) => s.navItems);
    const cta = useHeaderNavStore((s) => s.cta);
    const isOpen = useMobileMenuSheetStore((s) => s.isOpen);
    const close = useMobileMenuSheetStore((s) => s.close);

    const isSigninPage = pathname.endsWith('/auth/signin');
    const hasNav = navItems.length > 0;

    const { visibleItems, handleSelect, initials } = useUserMenu({
        profile: <User />,
        billing: <CreditCard />,
        logout: <LogOut />,
    });

    return (
        <UiSheet open={isOpen} onOpenChange={(open) => !open && close()}>
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
                            {navItems.map(({ href, label }) => (
                                <a
                                    key={href}
                                    href={href}
                                    className="text-muted-foreground hover:text-foreground py-2 text-sm transition-colors"
                                    onClick={close}
                                >
                                    {label}
                                </a>
                            ))}
                        </nav>
                    )}

                    {hasNav && <div className="bg-border h-px" />}

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
                                        src={user.profile.avatar ?? undefined}
                                        alt={user.profile.name ?? ''}
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

                            {visibleItems.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    className={`flex items-center gap-2 py-2 text-sm transition-colors ${
                                        item.value === 'logout'
                                            ? 'text-destructive hover:text-destructive/80'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    onClick={() =>
                                        handleSelect(item.value, close)
                                    }
                                >
                                    <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
                                        {item.icon}
                                    </span>
                                    <span>{item.label}</span>
                                    {item.badge != null && (
                                        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-xs leading-none">
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
                                onClick={close}
                            >
                                {t('signin')}
                            </UiButton>
                        )
                    )}

                    {/* Mobile CTA */}
                    {cta && (
                        <UiButton
                            variant="filled"
                            size="md"
                            className="mt-2 w-full"
                            onClick={() => {
                                close();
                                cta.onClick?.();
                            }}
                        >
                            {cta.label}
                        </UiButton>
                    )}
                </div>
            </UiSheetContent>
        </UiSheet>
    );
}
