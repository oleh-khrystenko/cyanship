import { create } from 'zustand';
import type { ProofTabKey } from '@/widgets/agency/landing/DogfoodingSection/types';

interface DogfoodingSheetState {
    activeTab: ProofTabKey | null;
    setActiveTab: (tab: ProofTabKey | null) => void;
}

export const useDogfoodingSheetStore = create<DogfoodingSheetState>((set) => ({
    activeTab: null,
    setActiveTab: (activeTab) => set({ activeTab }),
}));
