'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, CreditCard, Gauge, type LucideIcon } from 'lucide-react';
import { composeClasses } from '@/shared/lib';
import type { ProofTabKey } from './types';

interface ProofTabsProps {
    activeTab: ProofTabKey;
    onTabChange: (tab: ProofTabKey) => void;
}

const tabs: { key: ProofTabKey; icon: LucideIcon; labelKey: string }[] = [
    { key: 'auth', icon: UserPlus, labelKey: 'step_1' },
    { key: 'billing', icon: CreditCard, labelKey: 'step_2' },
    { key: 'lighthouse', icon: Gauge, labelKey: 'step_3' },
];

const ProofTabs = ({ activeTab, onTabChange }: ProofTabsProps) => {
    const t = useTranslations('landing_page.dogfooding');

    return (
        <div className="space-y-3">
            {tabs.map(({ key, icon: Icon, labelKey }) => {
                const isActive = activeTab === key;

                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onTabChange(key)}
                        className={composeClasses(
                            'flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors',
                            isActive
                                ? 'border-primary bg-primary/5'
                                : 'border-border bg-card hover:bg-accent'
                        )}
                    >
                        <div
                            className={composeClasses(
                                'flex size-6 shrink-0 items-center justify-center rounded-full',
                                isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-foreground text-background'
                            )}
                        >
                            <Icon className="size-3.5" />
                        </div>
                        <span className="text-foreground">{t(labelKey)}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default ProofTabs;
