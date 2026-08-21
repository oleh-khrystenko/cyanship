'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { LANDING_NAV_ITEMS } from './sections';
import { useAnchorNav } from './useAnchorNav';

export default function LandingNav() {
    const tNav = useTranslations('landing_page.nav');

    const items = useMemo(
        () =>
            LANDING_NAV_ITEMS.map(({ key, href }) => ({
                href,
                label: tNav(key),
            })),
        [tNav]
    );

    useAnchorNav(items);

    return null;
}
