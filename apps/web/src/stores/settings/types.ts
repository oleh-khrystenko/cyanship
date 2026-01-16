import { TTheme } from '@/shared/types/settings';

export interface ISettingsStore {
    theme: TTheme;
    setTheme: (value: TTheme) => void;
}
