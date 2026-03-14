import { create } from 'zustand';
import type { UserProfile } from '@lucidship/types';

interface AuthState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    termsOutdated: boolean;
    setUser: (user: UserProfile) => void;
    clearUser: () => void;
    setLoading: (isLoading: boolean) => void;
    setTermsOutdated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    termsOutdated: false,
    setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),
    clearUser: () =>
        set({ user: null, isAuthenticated: false, isLoading: false, termsOutdated: false }),
    setLoading: (isLoading) => set({ isLoading }),
    setTermsOutdated: (termsOutdated) => set({ termsOutdated }),
}));
