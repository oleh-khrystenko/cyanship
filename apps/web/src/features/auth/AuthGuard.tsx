'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

import UiSpinner from '@/shared/ui/UiSpinner';
import { useAuthStore } from '@/stores/auth';

interface AuthGuardProps {
    children: ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps) => {
    const router = useRouter();
    const { locale } = useParams<{ locale: string }>();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isLoading = useAuthStore((s) => s.isLoading);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace(`/${locale}/auth/signin`);
        }
    }, [isLoading, isAuthenticated, router, locale]);

    if (isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center">
                <UiSpinner size="lg" />
            </main>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
};

export default AuthGuard;
