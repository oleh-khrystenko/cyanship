'use client';

import { FC, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon } from '@/shared/icons';
import UiSwitch from '@/shared/ui/UiSwitch';

const ChangeTheme: FC = () => {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    const handleToggleTheme = () => {
        setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
    };

    return (
        <UiSwitch
            checked={resolvedTheme === 'dark'}
            onChange={handleToggleTheme}
        >
            <SunIcon />
            <MoonIcon />
        </UiSwitch>
    );
};

export default ChangeTheme;
