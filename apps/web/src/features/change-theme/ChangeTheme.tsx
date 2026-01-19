'use client';

import { FC, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, SunMoon } from 'lucide-react';
import UiSelect from '@/shared/ui/UiSelect';

const emptySubscribe = () => () => {};

const themeOptions = [
    {
        value: 'system',
        label: <SunMoon className="h-5 w-5" />,
    },
    {
        value: 'light',
        label: <Sun className="h-5 w-5" />,
    },
    {
        value: 'dark',
        label: <Moon className="h-5 w-5" />,
    },
];

const ChangeTheme: FC = () => {
    const { theme, setTheme } = useTheme();
    const mounted = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );

    if (!mounted) {
        return (
            <div className="bg-ash h-8.5 w-13 animate-pulse rounded-md" />
        );
    }

    return (
        <UiSelect
            options={themeOptions}
            value={theme ?? 'system'}
            onChange={setTheme}
            label="Change theme"
        />
    );
};

export default ChangeTheme;
