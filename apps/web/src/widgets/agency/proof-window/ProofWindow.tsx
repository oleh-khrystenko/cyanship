'use client';

import { useState, useEffect } from 'react';
import { ProofAuth, ProofBilling, ProofUsage } from '@/features/agency/proof';
import type { ProofTabKey } from './types';

type ProofWindowVariant = 'card' | 'embedded';

interface ProofWindowProps {
    activeTab: ProofTabKey;
    title?: string;
    onRequestAuth: () => void;
    variant?: ProofWindowVariant;
    /**
     * Anchor of the section that owns this window. The auth and billing panels
     * leave the site (OAuth, magic link, Stripe) and need an address to come
     * back to; that address is this anchor on the page currently open, never a
     * fixed one — the same window is mounted by the home page and by the
     * archived landing under different anchors.
     */
    sectionId: string;
}

const panels: Record<
    ProofTabKey,
    React.ComponentType<{ onRequestAuth?: () => void; sectionId: string }>
> = {
    auth: ProofAuth,
    billing: ProofBilling,
    usage: ProofUsage,
};

const variantStyles: Record<ProofWindowVariant, string> = {
    card: 'flex-1 overflow-y-auto rounded-xl border border-border bg-card p-8',
    embedded: 'flex-1',
};

const ProofWindow = ({
    activeTab,
    title,
    onRequestAuth,
    variant = 'card',
    sectionId,
}: ProofWindowProps) => {
    const [displayedTab, setDisplayedTab] = useState(activeTab);
    const [visible, setVisible] = useState(true);

    // Trigger fade-out immediately when activeTab changes (state-during-render pattern)
    if (activeTab !== displayedTab && visible) {
        setVisible(false);
    }

    // After fade-out completes, swap panel and fade back in
    useEffect(() => {
        if (visible) return;

        const timeout = setTimeout(() => {
            setDisplayedTab(activeTab);
            setVisible(true);
        }, 150);

        return () => clearTimeout(timeout);
    }, [visible, activeTab]);

    const Panel = panels[displayedTab];

    return (
        <div className={`flex flex-col ${variantStyles[variant]}`}>
            {title && (
                <h3 className="text-foreground mb-6 text-center text-2xl font-semibold">
                    {title}
                </h3>
            )}
            <div
                className="flex flex-1 flex-col items-center justify-center transition-opacity duration-150"
                style={{ opacity: visible ? 1 : 0 }}
            >
                <Panel onRequestAuth={onRequestAuth} sectionId={sectionId} />
            </div>
        </div>
    );
};

export default ProofWindow;
