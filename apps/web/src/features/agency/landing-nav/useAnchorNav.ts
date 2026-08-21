'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useHeaderNavStore } from '@/entities/navigation';
import { useBriefDialogStore } from '@/features/agency/brief';

export interface AnchorNavItem {
    href: string;
    label: string;
}

/**
 * Anchor navigation belongs to the page that owns the sections, not to the
 * section layout: the legal pages share that layout and have nothing to scroll
 * to. `items` must be memoised by the caller — a fresh array on every render
 * would republish the nav on every render.
 */
export function useAnchorNav(items: AnchorNavItem[]) {
    const tHeader = useTranslations('components.header');
    const setNav = useHeaderNavStore((s) => s.setNav);
    const clearNav = useHeaderNavStore((s) => s.clearNav);

    useEffect(() => {
        setNav(items, {
            label: tHeader('get_started'),
            onClick: () => useBriefDialogStore.getState().open(),
        });

        return () => clearNav();
    }, [items, tHeader, setNav, clearNav]);
}
