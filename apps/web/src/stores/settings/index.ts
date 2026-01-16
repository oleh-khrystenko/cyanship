import { create } from 'zustand';
import { CTheme } from '@/shared/types/settings';
import { ISettingsStore } from '@/stores/settings/types';

export const useSettingsStore = create<ISettingsStore>((set) => ({
    theme: CTheme.DARK,
    setTheme: (value) => {
        set((state) => ({
            ...state,
            theme: value,
        }));
    },
}));
