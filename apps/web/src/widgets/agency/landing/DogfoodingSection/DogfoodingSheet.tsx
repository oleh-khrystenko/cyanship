'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    UiSheet,
    UiSheetContent,
    UiSheetHeader,
    UiSheetTitle,
} from '@/shared/ui/UiSheet';
import { useDogfoodingSheetStore } from '@/stores/dogfoodingSheet';
import ProofWindow from './ProofWindow';

const DESKTOP_MQ = '(min-width: 1024px)';

export default function DogfoodingSheet() {
    const t = useTranslations('landing_page.dogfooding');
    const activeTab = useDogfoodingSheetStore((s) => s.activeTab);
    const setActiveTab = useDogfoodingSheetStore((s) => s.setActiveTab);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia(DESKTOP_MQ);
        setIsDesktop(mql.matches);
        const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

    const sheetOpen = !isDesktop && activeTab !== null;

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setActiveTab(null);
        }
    };

    const handleInteractOutside = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-dogfooding-tabs]')) {
            e.preventDefault();
        }
    };

    return (
        <UiSheet open={sheetOpen} onOpenChange={handleOpenChange} modal={false}>
            <UiSheetContent
                side="bottom"
                hideOverlay
                onInteractOutside={handleInteractOutside}
            >
                <UiSheetHeader>
                    <UiSheetTitle className="text-xl">
                        {activeTab && t(`proof_shell.sheet_title_${activeTab}`)}
                    </UiSheetTitle>
                </UiSheetHeader>
                <div className="flex h-[60vh] flex-col overflow-y-auto p-4 pt-0">
                    {activeTab && (
                        <ProofWindow
                            activeTab={activeTab}
                            onRequestAuth={() => setActiveTab('auth')}
                            variant="embedded"
                        />
                    )}
                </div>
            </UiSheetContent>
        </UiSheet>
    );
}
