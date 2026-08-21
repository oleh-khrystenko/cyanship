'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, CreditCard, Activity, type LucideIcon } from 'lucide-react';
import UiButton from '@/shared/ui/UiButton';
import { composeClasses } from '@/shared/lib';
import type { ProofTabKey } from './types';

interface ProofTabsProps {
    activeTab: ProofTabKey | null;
    onTabChange: (tab: ProofTabKey) => void;
}

const tabs: { key: ProofTabKey; icon: LucideIcon; labelKey: string }[] = [
    { key: 'auth', icon: UserPlus, labelKey: 'step_1' },
    { key: 'billing', icon: CreditCard, labelKey: 'step_2' },
    { key: 'usage', icon: Activity, labelKey: 'step_3' },
];

/**
 * The row is a `UiButton` in its `bare` variant: the surface — background,
 * padding, hover — belongs to the content, and the primitive keeps only what a
 * primitive must own (the element, the type, the cursor, the disabled
 * handling). See `docs/conventions/ui-primitives.md` for when to reach for it.
 */
const ProofTabs = ({ activeTab, onTabChange }: ProofTabsProps) => {
    const t = useTranslations('proof_window');

    return (
        <div className="divide-border border-border divide-y overflow-hidden rounded-lg border">
            {tabs.map(({ key, icon: Icon, labelKey }) => {
                const isActive = activeTab === key;

                return (
                    <UiButton
                        key={key}
                        variant="bare"
                        onClick={() => onTabChange(key)}
                        className="w-full"
                    >
                        <span
                            className={composeClasses(
                                'flex w-full items-center gap-4 p-4 text-left transition-colors',
                                isActive
                                    ? 'bg-primary/5'
                                    : 'bg-card hover:bg-accent'
                            )}
                        >
                            <span
                                className={composeClasses(
                                    'flex size-10 shrink-0 items-center justify-center rounded-lg',
                                    isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'border-border bg-secondary text-muted-foreground border'
                                )}
                            >
                                <Icon className="size-4" />
                            </span>
                            <span className="text-foreground">
                                {t(labelKey)}
                            </span>
                            <span className="text-primary ml-auto text-xs whitespace-nowrap lg:hidden">
                                {t('shell.try_it')}
                            </span>
                        </span>
                    </UiButton>
                );
            })}
        </div>
    );
};

export default ProofTabs;
