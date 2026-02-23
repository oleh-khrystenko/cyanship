import { create } from 'zustand';
import type { UserProfile } from '@lucidkit/types';

interface AuthState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setUser: (user: UserProfile) => void;
    clearUser: () => void;
    setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),
    clearUser: () =>
        set({ user: null, isAuthenticated: false, isLoading: false }),
    setLoading: (isLoading) => set({ isLoading }),
}));
