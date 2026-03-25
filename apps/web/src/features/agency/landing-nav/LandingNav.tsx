'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useHeaderNavStore } from '@/stores/headerNav';
import { useBriefDialogStore } from '@/stores/briefDialog';

const navKeys = [
    { key: 'approach', href: '#problem' },
    { key: 'proof', href: '#dogfooding' },
    // { key: 'portfolio', href: '#portfolio' },
    { key: 'workflow', href: '#workflow' },
    { key: 'pricing', href: '#pricing' },
    { key: 'get_started', href: '#footer-cta' },
] as const;

export default function LandingNav() {
    const tNav = useTranslations('landing_page.nav');
    const tHeader = useTranslations('components.header');
    const setNav = useHeaderNavStore((s) => s.setNav);
    const clearNav = useHeaderNavStore((s) => s.clearNav);

    useEffect(() => {
        const items = navKeys.map(({ key, href }) => ({
            href,
            label: tNav(key),
        }));

        setNav(items, {
            label: tHeader('get_started'),
            onClick: () => useBriefDialogStore.getState().open(),
        });

        return () => clearNav();
    }, [tNav, tHeader, setNav, clearNav]);

    return null;
}
