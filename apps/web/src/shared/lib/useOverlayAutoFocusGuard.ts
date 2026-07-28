'use client';

import { useCallback, useRef } from 'react';
import { isDesktopViewport } from './viewport';

/**
 * Suppresses initial focus inside mobile overlays: a focused field raises the
 * virtual keyboard and collapses the sheet layout — see
 * docs/conventions/responsive.md. Desktop keeps Radix' default behaviour.
 *
 * Two layers are needed because initial focus can be claimed by two actors:
 * - Radix' focus scope, through `onOpenAutoFocus`;
 * - React itself, when a child field is rendered with `autoFocus` — that runs
 *   during commit, before the focus scope mounts, so Radix sees focus already
 *   inside the content and never fires `onOpenAutoFocus`. Without the ref
 *   callback below a single `autoFocus` at any callsite would bypass the guard.
 *
 * The second layer lives in the ref callback rather than an effect: the hook is
 * called by the wrapper component, which stays mounted while the overlay is
 * closed, so a mount effect would run once — with no content in the DOM — and
 * never again. The ref, in contrast, is attached on every open, right after
 * React has applied a child's `autoFocus` and before the focus scope runs.
 */
export function useOverlayAutoFocusGuard(
    onOpenAutoFocus?: (event: Event) => void,
) {
    const contentRef = useRef<HTMLDivElement | null>(null);

    const setContentRef = useCallback((node: HTMLDivElement | null) => {
        contentRef.current = node;
        if (!node || isDesktopViewport()) return;

        const active = document.activeElement;
        if (active !== node && node.contains(active)) node.focus();
    }, []);

    const handleOpenAutoFocus = (event: Event) => {
        onOpenAutoFocus?.(event);
        if (event.defaultPrevented || isDesktopViewport()) return;
        event.preventDefault();
        contentRef.current?.focus();
    };

    return { contentRef: setContentRef, handleOpenAutoFocus };
}
