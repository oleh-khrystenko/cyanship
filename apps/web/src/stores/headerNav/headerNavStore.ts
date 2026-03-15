import { create } from 'zustand';

interface NavItem {
    href: string;
    label: string;
}

interface CtaConfig {
    href: string;
    label: string;
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
