'use client';

import { FC } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Sun, Moon, SunMoon } from 'lucide-react';
import { THEME, Theme } from '@/shared/types/settings';
import UiButton from '@/shared/ui/UiButton';
import UiDropdownMenu from '@/shared/ui/UiDropdownMenu';
import type { UiDropdownMenuItem } from '@/shared/ui/UiDropdownMenu';

const THEME_ICONS: Record<Theme, typeof Sun> = {
    [THEME.LIGHT]: Sun,
    [THEME.SYSTEM]: SunMoon,
    [THEME.DARK]: Moon,
};

const THEME_KEYS: { value: Theme; key: string }[] = [
    { value: THEME.LIGHT, key: 'light' },
    { value: THEME.SYSTEM, key: 'system' },
    { value: THEME.DARK, key: 'dark' },
];

const ChangeTheme: FC = () => {
    const { theme, setTheme } = useTheme();
    const t = useTranslations('components.change_theme');

    const TriggerIcon = THEME_ICONS[(theme as Theme) ?? THEME.SYSTEM];

    const items: UiDropdownMenuItem[] = THEME_KEYS.map(({ value, key }) => {
        const Icon = THEME_ICONS[value];
        return {
            value,
            label: t(key),
            icon: <Icon />,
        };
    });

    return (
        <UiDropdownMenu
            items={items}
            onSelect={setTheme}
            activeValue={theme}
            align="end"
            size="sm"
            trigger={
                <UiButton
                    variant="icon"
                    size="sm"
                    aria-label={t('label')}
                    className="size-9"
                    IconLeft={<TriggerIcon />}
                />
            }
        />
    );
};

export default ChangeTheme;
