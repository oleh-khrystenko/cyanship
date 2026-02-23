'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { getMe, refreshToken } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

// Auth pages that handle their own refresh/verify flow
const SELF_AUTH_PATHS = ['/auth/callback', '/auth/verify'];

const AuthInitializer = () => {
    const setUser = useAuthStore((s) => s.setUser);
    const clearUser = useAuthStore((s) => s.clearUser);
    const pathname = usePathname();
    const triedRef = useRef(false);

    useEffect(() => {
        if (triedRef.current) return;
        triedRef.current = true;

        const isSelfAuthRoute = SELF_AUTH_PATHS.some((p) =>
            pathname.includes(p)
        );

        if (isSelfAuthRoute) return;

        const init = async () => {
            try {
                await refreshToken();
                const user = await getMe();
                setUser(user);
            } catch {
                clearUser();
            }
        };

        void init();
    }, [setUser, clearUser, pathname]);

    return null;
};

export default AuthInitializer;
