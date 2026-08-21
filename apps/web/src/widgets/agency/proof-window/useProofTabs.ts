'use client';

import { useEffect, useRef } from 'react';
import { useMediaQuery } from '@/shared/lib/useMediaQuery';
import { useProofWindowStore } from './proofWindowStore';
import type { ProofTabKey } from './types';

const DESKTOP_MQ = '(min-width: 1024px)';
const VALID_TABS = new Set<ProofTabKey>(['auth', 'billing', 'usage']);

/**
 * Everything the proof section needs beyond markup: which panel is open, how a
 * tap toggles it, and the deep link that brings a visitor back to the right
 * panel after Stripe or an OAuth round trip has taken the page away.
 *
 * `sectionId` is passed in rather than hard-coded because the same widget is
 * mounted by the live home page and by the archived landing under different
 * anchors — and the anchor is what the return URLs are written against. It is
 * published to the store as well, because on mobile the panels render inside
 * the globally mounted sheet, which has no section of its own to ask.
 */
export function useProofTabs(sectionId: string) {
    const activeTab = useProofWindowStore((s) => s.activeTab);
    const setActiveTab = useProofWindowStore((s) => s.setActiveTab);
    const setSectionId = useProofWindowStore((s) => s.setSectionId);
    const isDesktop = useMediaQuery(DESKTOP_MQ);
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (isDesktop) {
            setActiveTab(useProofWindowStore.getState().activeTab ?? 'auth');
        } else {
            setActiveTab(null);
        }
    }, [isDesktop, setActiveTab]);

    useEffect(() => {
        const applyDeepLink = () => {
            const match = window.location.hash.match(
                new RegExp(`^#${sectionId}-(\\w+)$`)
            );
            const tab = match?.[1] as ProofTabKey | undefined;
            if (!tab || !VALID_TABS.has(tab)) return;

            setActiveTab(tab);
            sectionRef.current?.scrollIntoView({ behavior: 'smooth' });
            history.replaceState(null, '', `#${sectionId}`);
        };

        applyDeepLink();
        window.addEventListener('hashchange', applyDeepLink);
        return () => window.removeEventListener('hashchange', applyDeepLink);
    }, [sectionId, setActiveTab]);

    // The open panel belongs to this section, but the sheet that shows it on
    // mobile is mounted globally and outlives the page. Dropping the section on
    // unmount closes that sheet — without it, a visitor who opens a panel and
    // then follows a footer link keeps a live billing sheet floating over the
    // legal pages.
    //
    // The tab itself is left alone on purpose: it is the section's own effects
    // that decide which panel belongs open, and clearing it here would also
    // wipe the tab a deep link had just selected on the way back from Stripe.
    useEffect(() => {
        setSectionId(sectionId);

        return () => setSectionId(null);
    }, [sectionId, setSectionId]);

    const handleTabChange = (tab: ProofTabKey) => {
        if (!isDesktop && activeTab === tab) {
            setActiveTab(null);
        } else {
            setActiveTab(tab);
        }
    };

    return { activeTab, handleTabChange, sectionRef };
}
