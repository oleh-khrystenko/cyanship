'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useDogfoodingSheetStore } from '@/stores/dogfoodingSheet';
import ProofTabs from './ProofTabs';
import ProofWindow from './ProofWindow';
import type { ProofTabKey } from './types';

const DESKTOP_MQ = '(min-width: 1024px)';
const VALID_TABS = new Set<ProofTabKey>(['auth', 'billing', 'usage']);

function parseTabFromHash(hash: string): ProofTabKey | null {
    const match = hash.match(/^#dogfooding-(\w+)$/);
    const tab = match?.[1] as ProofTabKey | undefined;
    return tab && VALID_TABS.has(tab) ? tab : null;
}

const DogfoodingSection = () => {
    const t = useTranslations('landing_page.dogfooding');
    const activeTab = useDogfoodingSheetStore((s) => s.activeTab);
    const setActiveTab = useDogfoodingSheetStore((s) => s.setActiveTab);
    const [isDesktop, setIsDesktop] = useState(false);
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const mql = window.matchMedia(DESKTOP_MQ);

        const applyDeepLink = () => {
            const tab = parseTabFromHash(window.location.hash);
            if (tab) {
                setActiveTab(tab);
                sectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                history.replaceState(null, '', '#dogfooding');
            }
        };

        const update = (matches: boolean) => {
            setIsDesktop(matches);

            if (matches) {
                setActiveTab(useDogfoodingSheetStore.getState().activeTab ?? 'auth');
            } else {
                setActiveTab(null);
            }
        };

        update(mql.matches);
        applyDeepLink();

        window.addEventListener('hashchange', applyDeepLink);
        const handler = (e: MediaQueryListEvent) => update(e.matches);
        mql.addEventListener('change', handler);
        return () => {
            window.removeEventListener('hashchange', applyDeepLink);
            mql.removeEventListener('change', handler);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleTabChange = (tab: ProofTabKey) => {
        if (!isDesktop && activeTab === tab) {
            setActiveTab(null);
        } else {
            setActiveTab(tab);
        }
    };

    return (
        <section ref={sectionRef} id="dogfooding" className="scroll-mt-16 border-t border-border py-24">
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

                        <div className="mt-12" data-dogfooding-tabs>
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
                                onRequestAuth={() => setActiveTab('auth')}
                            />
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default DogfoodingSection;
