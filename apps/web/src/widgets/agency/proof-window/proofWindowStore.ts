import { create } from 'zustand';

export type ProofTabKey = 'auth' | 'billing' | 'usage';

interface ProofWindowState {
    activeTab: ProofTabKey | null;
    /**
     * Anchor of the section currently showing the proof window, registered by
     * that section on mount. The mobile sheet is mounted globally and has no
     * section of its own, so this is the only way it can hand the panels an
     * address to return to after Stripe or an OAuth round trip.
     */
    sectionId: string | null;
    setActiveTab: (tab: ProofTabKey | null) => void;
    setSectionId: (sectionId: string | null) => void;
}

export const useProofWindowStore = create<ProofWindowState>((set) => ({
    activeTab: null,
    sectionId: null,
    setActiveTab: (activeTab) => set({ activeTab }),
    setSectionId: (sectionId) => set({ sectionId }),
}));
