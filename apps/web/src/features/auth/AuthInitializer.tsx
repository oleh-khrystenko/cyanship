'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { CURRENT_TERMS_VERSION } from '@lucidship/types';

import { getMe, refreshToken } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';
import { TermsReacceptModal } from './TermsReacceptModal';

// Auth pages that handle their own refresh/verify flow
const SELF_AUTH_PATHS = ['/auth/callback', '/auth/verify'];

const AuthInitializer = () => {
    const setUser = useAuthStore((s) => s.setUser);
    const clearUser = useAuthStore((s) => s.clearUser);
    const setTermsOutdated = useAuthStore((s) => s.setTermsOutdated);
    const termsOutdated = useAuthStore((s) => s.termsOutdated);
    const pathname = usePathname();
    const triedRef = useRef(false);

    useEffect(() => {
        if (triedRef.current) return;
        triedRef.current = true;

        const isSelfAuthRoute = SELF_AUTH_PATHS.some((p) =>
            pathname.includes(p)
        );

        if (isSelfAuthRoute) {
            clearUser();
            return;
        }

        const init = async () => {
            try {
                await refreshToken();
                const user = await getMe();
                setUser(user);

                if (user.termsVersion !== CURRENT_TERMS_VERSION) {
                    setTermsOutdated(true);
                }
            } catch {
                clearUser();
            }
        };

        void init();
    }, [setUser, clearUser, setTermsOutdated, pathname]);

    return (
        <TermsReacceptModal
            open={termsOutdated}
            onAccepted={() => setTermsOutdated(false)}
        />
    );
};

export default AuthInitializer;
