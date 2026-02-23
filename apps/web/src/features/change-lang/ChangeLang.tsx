'use client';

import { FC } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { UA, US } from 'country-flag-icons/react/3x2';
import { LANG } from '@lucidkit/types';
import { ChangeLangProps } from './types';
import UiSelect from '@/shared/ui/UiSelect';
import type { UiSelectOption } from '@/shared/ui/UiSelect';

const LANGS: UiSelectOption[] = [
    {
        label: (
            <div className="flex items-center gap-1.5">
                <US title="United States" className="h-5 w-7" />
                <span className="text-sm font-bold">Eng</span>
            </div>
        ),
        value: LANG.EN,
    },
    {
        label: (
            <div className="flex items-center gap-1.5">
                <UA title="Ukraine" className="h-5 w-7" />
                <span className="text-sm font-bold">Укр</span>
            </div>
        ),
        value: LANG.UK,
    },
];

const ChangeLang: FC<ChangeLangProps> = () => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const activeLocale = useLocale();
    const t = useTranslations('components.change_lang');

    const handleChangeLang = (value: string) => {
        const allSearchParams = searchParams.toString();
        const newPath = pathname.replace(`/${activeLocale}`, '');
        const newUrl = `/${value}${newPath}${allSearchParams ? `?${allSearchParams}` : ''}`;
        router.replace(newUrl);
    };

    return (
        <UiSelect
            label={t('label')}
            options={LANGS}
            value={activeLocale}
            onChange={handleChangeLang}
            variant="outlined"
            size="sm"
        />
    );
};

export default ChangeLang;
