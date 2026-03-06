'use client';

import { FC } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, SunMoon } from 'lucide-react';
import { THEME, Theme } from '@/shared/types/settings';
import UiButton from '@/shared/ui/UiButton';

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: THEME.LIGHT, icon: Sun, label: 'Light' },
    { value: THEME.SYSTEM, icon: SunMoon, label: 'System' },
    { value: THEME.DARK, icon: Moon, label: 'Dark' },
];

const ChangeTheme: FC = () => {
    const { theme, setTheme } = useTheme();

    return (
        <div
            role="group"
            aria-label="Theme"
            className="bg-surface border-border flex items-center rounded-full border p-0.5"
        >
            {THEME_OPTIONS.map(({ value, icon: Icon, label }) => {
                const isActive = theme === value;
                return (
                    <UiButton
                        key={value}
                        variant="icon-compact"
                        size="sm"
                        aria-label={label}
                        aria-pressed={isActive}
                        onClick={() => setTheme(value)}
                        className={`rounded-full p-1.5 transition-colors duration-200 ${
                            isActive
                                ? 'bg-primary/15 text-primary'
                                : 'text-text-secondary hover:text-text-primary'
                        }`}
                        IconLeft={Icon}
                    />
                );
            })}
        </div>
    );
};

export default ChangeTheme;
