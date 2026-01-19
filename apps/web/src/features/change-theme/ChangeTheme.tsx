'use client';

import { FC, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon, MonitorIcon } from '@/shared/icons';
import UiSelect from '@/shared/ui/UiSelect';

const emptySubscribe = () => () => {};

const themeOptions = [
    {
        value: 'system',
        label: <MonitorIcon classes="h-5 w-5 stroke-current" />,
    },
    {
        value: 'light',
        label: <SunIcon classes="h-5 w-5 stroke-current" />,
    },
    {
        value: 'dark',
        label: <MoonIcon classes="h-5 w-5 stroke-current" />,
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
