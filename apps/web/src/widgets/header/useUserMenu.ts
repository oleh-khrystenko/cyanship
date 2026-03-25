import { type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { getFullName } from '@cyanship/types';
import { logout } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

interface UserMenuItem {
    value: string;
    label: string;
    icon: ReactNode;
    route?: string;
    badge?: string;
}

export function getInitials(name: string | undefined, email: string): string {
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

export function useUserMenu(icons: {
    profile: ReactNode;
    billing: ReactNode;
    logout: ReactNode;
}) {
    const t = useTranslations('components.header');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const user = useAuthStore((s) => s.user);
    const clearUser = useAuthStore((s) => s.clearUser);

    const formattedExecutions = (user?.executions.balance ?? 0).toLocaleString('en-US');

    const allItems: UserMenuItem[] = [
        {
            value: 'profile',
            label: t('profile'),
            icon: icons.profile,
            route: `/${locale}/profile`,
        },
        {
            value: 'billing',
            label: t('billing'),
            icon: icons.billing,
            route: `/${locale}/billing`,
            badge: formattedExecutions,
        },
        {
            value: 'logout',
            label: t('logout'),
            icon: icons.logout,
        },
    ];

    const visibleItems = allItems.filter(
        (item) => !item.route || !pathname.startsWith(item.route)
    );

    const handleSelect = (value: string, onBeforeNavigate?: () => void) => {
        const item = allItems.find((i) => i.value === value);
        onBeforeNavigate?.();
        if (item?.route) {
            router.push(item.route);
        } else if (value === 'logout') {
            void (async () => {
                await logout();
                clearUser();
                window.location.assign(`/${locale}`);
            })();
        }
    };

    const fullName = user
        ? getFullName(user.profile.firstName, user.profile.lastName)
        : '';
    const initials = user ? getInitials(fullName, user.email) : '';

    return { allItems, visibleItems, handleSelect, initials };
}
