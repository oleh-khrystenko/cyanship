import { create } from 'zustand';

interface PortfolioCaseState {
    /** Slug of the open case, `null` when the dialog is closed. */
    slug: string | null;
    open: (slug: string) => void;
    close: () => void;
}

export const usePortfolioCaseStore = create<PortfolioCaseState>((set) => ({
    slug: null,
    open: (slug) => set({ slug }),
    close: () => set({ slug: null }),
}));
