'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { REBUILD_NAV_ITEMS } from './sections';
import { useAnchorNav } from './useAnchorNav';

export default function RebuildNav() {
    const tNav = useTranslations('home_page.nav');

    const items = useMemo(
        () =>
            REBUILD_NAV_ITEMS.map(({ key, href }) => ({
                href,
                label: tNav(key),
            })),
        [tNav]
    );

    useAnchorNav(items);

    return null;
}
