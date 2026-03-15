'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { isOnboardingComplete } from '@lucidship/types';

import UiFullPageLoader from '@/shared/ui/UiFullPageLoader';
import { useAuthStore } from '@/stores/auth';

interface AuthGuardProps {
    children: ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const { locale } = useParams<{ locale: string }>();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isLoading = useAuthStore((s) => s.isLoading);
    const user = useAuthStore((s) => s.user);

    const onboardingDone = user ? isOnboardingComplete(user.profile) : true;
    const isProfilePage = pathname.includes('/profile');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace(`/${locale}/auth/signin`);
        }
    }, [isLoading, isAuthenticated, router, locale]);

    useEffect(() => {
        if (isAuthenticated && !onboardingDone && !isProfilePage) {
            router.replace(`/${locale}/profile?mode=new`);
        }
    }, [isAuthenticated, onboardingDone, isProfilePage, router, locale]);

    if (isLoading) {
        return <UiFullPageLoader />;
    }

    if (!isAuthenticated) {
        return null;
    }

    if (!onboardingDone && !isProfilePage) {
        return null;
    }

    return <>{children}</>;
};

export default AuthGuard;
