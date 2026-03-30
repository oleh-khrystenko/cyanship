import { create } from 'zustand';

interface BriefDialogOpenOptions {
    requestAiBonus?: boolean;
}

interface BriefDialogState {
    isOpen: boolean;
    requestAiBonus: boolean;
    open: (opts?: BriefDialogOpenOptions) => void;
    close: () => void;
}

export const useBriefDialogStore = create<BriefDialogState>((set) => ({
    isOpen: false,
    requestAiBonus: false,
    open: (opts) =>
        set({ isOpen: true, requestAiBonus: opts?.requestAiBonus ?? false }),
    close: () => set({ isOpen: false, requestAiBonus: false }),
}));
