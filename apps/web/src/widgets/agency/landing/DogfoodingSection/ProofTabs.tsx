'use client';

import type { ProofTabKey } from './types';

interface ProofTabsProps {
    activeTab: ProofTabKey;
    onTabChange: (tab: ProofTabKey) => void;
}

const ProofTabs = ({ activeTab, onTabChange }: ProofTabsProps) => {
    return <div>ProofTabs: {activeTab}</div>;
};

export default ProofTabs;
