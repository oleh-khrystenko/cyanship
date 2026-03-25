import { create } from 'zustand';

interface BriefDialogState {
    isOpen: boolean;
    open: () => void;
    close: () => void;
}

export const useBriefDialogStore = create<BriefDialogState>((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
}));
