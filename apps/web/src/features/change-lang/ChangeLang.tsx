'use client';

import { FC } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { UA, US } from 'country-flag-icons/react/3x2';
import { LANG } from '@cyanship/types';
import { ChangeLangProps } from './types';
import UiButton from '@/shared/ui/UiButton';
import UiDropdownMenu from '@/shared/ui/UiDropdownMenu';
import type { UiDropdownMenuItem } from '@/shared/ui/UiDropdownMenu';
import { updatePreferredLang } from '@/shared/api';
import { useAuthStore } from '@/entities/user';

const LANG_ITEMS: UiDropdownMenuItem[] = [
    {
        value: LANG.EN,
        label: 'English',
        icon: <US title="United States" className="h-4 w-5 rounded-sm" />,
    },
    {
        value: LANG.UK,
        label: 'Українська',
        icon: <UA title="Ukraine" className="h-4 w-5 rounded-sm" />,
    },
];

const ChangeLang: FC<ChangeLangProps> = ({
    trigger: customTrigger,
    align = 'end',
    onSelected,
}) => {
    const router = useRouter();
    const pathname = usePathname();
    const activeLocale = useLocale();
    const t = useTranslations('components.change_lang');
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    const handleChangeLang = (value: string) => {
        // Fires even when the locale is unchanged: the click is a completed
        // choice, so a host surface like the mobile sheet must close either way.
        onSelected?.();

        if (value === activeLocale) return;

        // Read the query string off the location rather than via
        // `useSearchParams()`: the hook opts every route rendering the header
        // out of static generation, and the value is only ever needed here,
        // inside a click handler that by definition runs on the client.
        const allSearchParams = window.location.search.replace(/^\?/, '');
        const newPath = pathname.replace(`/${activeLocale}`, '');
        const newUrl = `/${value}${newPath}${allSearchParams ? `?${allSearchParams}` : ''}`;
        router.replace(newUrl);

        if (isAuthenticated) {
            void updatePreferredLang(value);
        }
    };

    const defaultTrigger = (
        <UiButton
            variant="icon"
            size="sm"
            aria-label={t('label')}
            className="size-9"
            IconLeft={<Globe />}
        />
    );

    return (
        <UiDropdownMenu
            items={LANG_ITEMS}
            onSelect={handleChangeLang}
            activeValue={activeLocale}
            align={align}
            size="sm"
            trigger={customTrigger ?? defaultTrigger}
        />
    );
};

export default ChangeLang;
