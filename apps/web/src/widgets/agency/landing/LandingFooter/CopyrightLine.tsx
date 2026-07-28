'use client';

import { FC, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';

interface CopyrightLineProps {
    /**
     * Year captured while the page was rendered. On statically prerendered
     * routes this is the build date, not the current one.
     */
    prerenderedYear: number;
}

/** The year never changes while the tab is open, so there is nothing to subscribe to. */
const subscribe = () => () => {};

const getCurrentYear = () => new Date().getFullYear();

/**
 * The landing and legal pages are prerendered at build time, so a year read on
 * the server would stay frozen until the next deploy. The server snapshot keeps
 * hydration in sync with the static HTML, then React swaps in the browser's own
 * clock — no cascading render, no hydration mismatch.
 */
const CopyrightLine: FC<CopyrightLineProps> = ({ prerenderedYear }) => {
    const t = useTranslations('landing_page.footer');
    const year = useSyncExternalStore(
        subscribe,
        getCurrentYear,
        () => prerenderedYear
    );

    return (
        <p className="text-muted-foreground text-center text-sm">
            {t('copyright', { year })}
        </p>
    );
};

export default CopyrightLine;
