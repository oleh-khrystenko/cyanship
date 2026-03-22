'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    UiSheet,
    UiSheetContent,
    UiSheetHeader,
    UiSheetTitle,
} from '@/shared/ui/UiSheet';
import ProofTabs from './ProofTabs';
import ProofWindow from './ProofWindow';
import type { ProofTabKey } from './types';

const DogfoodingSection = () => {
    const t = useTranslations('landing_page.dogfooding');
    const [activeTab, setActiveTab] = useState<ProofTabKey | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const isMobile = () => !window.matchMedia('(min-width: 1024px)').matches;

    const handleTabChange = (tab: ProofTabKey) => {
        setActiveTab(tab);

        if (isMobile()) {
            setSheetOpen(true);
        }
    };

    const handleSheetOpenChange = (open: boolean) => {
        setSheetOpen(open);

        if (!open && isMobile()) {
            setActiveTab(null);
        }
    };

    const handleRequestAuth = () => {
        setActiveTab('auth');
    };

    return (
        <section id="dogfooding" className="scroll-mt-28 border-t border-border py-24">
            <div className="container px-6">
                <div className="grid items-stretch gap-8 lg:grid-cols-2 lg:gap-12">
                    <div>
                        <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                            {t('label')}
                        </span>
                        <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                            {t('heading')}
                        </h2>
                        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                            {t('description')}
                        </p>

                        <div className="mt-12">
                            <ProofTabs
                                activeTab={activeTab}
                                onTabChange={handleTabChange}
                            />
                        </div>
                    </div>

                    <div className="hidden lg:flex lg:flex-col">
                        {activeTab && (
                            <ProofWindow
                                activeTab={activeTab}
                                onRequestAuth={handleRequestAuth}
                            />
                        )}
                    </div>
                </div>

                <UiSheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
                    <UiSheetContent side="bottom">
                        <UiSheetHeader>
                            <UiSheetTitle>
                                {t('proof_shell.sheet_title')}
                            </UiSheetTitle>
                        </UiSheetHeader>
                        <div className="h-[70vh] overflow-y-auto p-4 pt-0">
                            {activeTab && (
                                <ProofWindow
                                    activeTab={activeTab}
                                    onRequestAuth={handleRequestAuth}
                                />
                            )}
                        </div>
                    </UiSheetContent>
                </UiSheet>
            </div>
        </section>
    );
};

export default DogfoodingSection;
