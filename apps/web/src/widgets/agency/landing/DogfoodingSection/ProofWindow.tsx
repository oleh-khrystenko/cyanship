'use client';

import { useState, useEffect } from 'react';
import { ProofAuth, ProofBilling, ProofLighthouse } from '@/features/agency/proof';
import type { ProofTabKey } from './types';

interface ProofWindowProps {
    activeTab: ProofTabKey;
    onRequestAuth: () => void;
}

const panels: Record<ProofTabKey, React.ComponentType<{ onRequestAuth?: () => void }>> = {
    auth: ProofAuth,
    billing: ProofBilling,
    lighthouse: ProofLighthouse,
};

const ProofWindow = ({ activeTab, onRequestAuth }: ProofWindowProps) => {
    const [displayedTab, setDisplayedTab] = useState(activeTab);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (activeTab === displayedTab) return;

        setVisible(false);

        const timeout = setTimeout(() => {
            setDisplayedTab(activeTab);
            setVisible(true);
        }, 150);

        return () => clearTimeout(timeout);
    }, [activeTab, displayedTab]);

    const Panel = panels[displayedTab];

    return (
        <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-6">
            <div
                className="transition-opacity duration-150"
                style={{ opacity: visible ? 1 : 0 }}
            >
                <Panel onRequestAuth={onRequestAuth} />
            </div>
        </div>
    );
};

export default ProofWindow;
