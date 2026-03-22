'use client';

import { useState, useEffect, useRef } from 'react';
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

const DESKTOP_MQ = '(min-width: 1024px)';

const DogfoodingSection = () => {
    const t = useTranslations('landing_page.dogfooding');
    const [activeTab, setActiveTab] = useState<ProofTabKey | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);
    const tabsRef = useRef<HTMLDivElement>(null);

    const sheetOpen = !isDesktop && activeTab !== null;

    useEffect(() => {
        const mql = window.matchMedia(DESKTOP_MQ);

        const update = (matches: boolean) => {
            setIsDesktop(matches);

            if (matches) {
                setActiveTab((prev) => prev ?? 'auth');
            } else {
                setActiveTab(null);
            }
        };

        update(mql.matches);

        const handler = (e: MediaQueryListEvent) => update(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

    const handleTabChange = (tab: ProofTabKey) => {
        if (!isDesktop && activeTab === tab) {
            setActiveTab(null);
        } else {
            setActiveTab(tab);
        }
    };

    const handleSheetOpenChange = (open: boolean) => {
        if (!open) {
            setActiveTab(null);
        }
    };

    const handleInteractOutside = (e: Event) => {
        if (tabsRef.current?.contains(e.target as Node)) {
            e.preventDefault();
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

                        <div ref={tabsRef} className="mt-12">
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

                <UiSheet open={sheetOpen} onOpenChange={handleSheetOpenChange} modal={false}>
                    <UiSheetContent
                        side="bottom"
                        hideOverlay
                        onInteractOutside={handleInteractOutside}
                    >
                        <UiSheetHeader>
                            <UiSheetTitle>
                                {t('proof_shell.sheet_title')}
                            </UiSheetTitle>
                        </UiSheetHeader>
                        <div className="h-[60vh] overflow-y-auto p-4 pt-0">
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
