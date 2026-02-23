'use client';

import { useEffect, useRef } from 'react';

import { getMe, refreshToken } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';

const AuthInitializer = () => {
    const setUser = useAuthStore((s) => s.setUser);
    const clearUser = useAuthStore((s) => s.clearUser);
    const triedRef = useRef(false);

    useEffect(() => {
        if (triedRef.current) return;
        triedRef.current = true;

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
    }, [setUser, clearUser]);

    return null;
};

export default AuthInitializer;
