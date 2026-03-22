'use client';

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
    const Panel = panels[activeTab];

    return (
        <div className="h-[420px] overflow-y-auto rounded-xl border border-border bg-card p-6">
            <Panel onRequestAuth={onRequestAuth} />
        </div>
    );
};

export default ProofWindow;
