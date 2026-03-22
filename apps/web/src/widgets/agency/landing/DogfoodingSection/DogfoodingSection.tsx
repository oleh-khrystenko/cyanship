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
    const [activeTab, setActiveTab] = useState<ProofTabKey>('auth');
    const [sheetOpen, setSheetOpen] = useState(false);

    const handleTabChange = (tab: ProofTabKey) => {
        setActiveTab(tab);

        if (!window.matchMedia('(min-width: 1024px)').matches) {
            setSheetOpen(true);
        }
    };

    const handleRequestAuth = () => {
        setActiveTab('auth');
    };

    return (
        <section id="dogfooding" className="scroll-mt-28 border-t border-border py-24">
            <div className="container px-6">
                <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
                    <div className="lg:sticky lg:top-24">
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

                    <div className="hidden lg:block lg:pt-[7.5rem]">
                        <ProofWindow
                            activeTab={activeTab}
                            onRequestAuth={handleRequestAuth}
                        />
                    </div>
                </div>

                <UiSheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <UiSheetContent side="bottom">
                        <UiSheetHeader>
                            <UiSheetTitle>
                                {t('proof_shell.sheet_title')}
                            </UiSheetTitle>
                        </UiSheetHeader>
                        <div className="p-4 pt-0">
                            <ProofWindow
                                activeTab={activeTab}
                                onRequestAuth={handleRequestAuth}
                            />
                        </div>
                    </UiSheetContent>
                </UiSheet>
            </div>
        </section>
    );
};

export default DogfoodingSection;
