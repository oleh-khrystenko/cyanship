'use client';

import { FC, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon, MonitorIcon } from '@/shared/icons';
import UiSelect from '@/shared/ui/UiSelect';

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
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

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
