import { type ReactNode } from 'react';
import { create } from 'zustand';

interface NavItem {
    href: string;
    label: string;
}

interface CtaConfig {
    label: string;
    href?: string;
    renderWrapper?: (children: ReactNode) => ReactNode;
}

interface HeaderNavState {
    navItems: NavItem[];
    cta: CtaConfig | null;
    setNav: (navItems: NavItem[], cta?: CtaConfig) => void;
    clearNav: () => void;
}

export const useHeaderNavStore = create<HeaderNavState>((set) => ({
    navItems: [],
    cta: null,
    setNav: (navItems, cta) => set({ navItems, cta: cta ?? null }),
    clearNav: () => set({ navItems: [], cta: null }),
}));
