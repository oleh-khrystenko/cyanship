'use client';

import { useTranslations } from 'next-intl';
import {
    UiSheet,
    UiSheetContent,
    UiSheetHeader,
    UiSheetTitle,
} from '@/shared/ui/UiSheet';
import { useMediaQuery } from '@/shared/lib/useMediaQuery';
import { useProofWindowStore } from './proofWindowStore';
import ProofWindow from './ProofWindow';

const DESKTOP_MQ = '(min-width: 1024px)';

export default function ProofSheet() {
    const t = useTranslations('proof_window');
    const activeTab = useProofWindowStore((s) => s.activeTab);
    const setActiveTab = useProofWindowStore((s) => s.setActiveTab);
    const sectionId = useProofWindowStore((s) => s.sectionId);
    const isDesktop = useMediaQuery(DESKTOP_MQ);

    // `sectionId` is set by the section that owns the open panel, so it is
    // always present while a tab is active; requiring it keeps the panels from
    // ever rendering without an address to return to.
    const sheetOpen = !isDesktop && activeTab !== null && sectionId !== null;

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setActiveTab(null);
        }
    };

    const handleInteractOutside = (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-proof-tabs]')) {
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
                    <UiSheetTitle>
                        {activeTab && t(`shell.sheet_title_${activeTab}`)}
                    </UiSheetTitle>
                </UiSheetHeader>
                <div className="flex h-[60vh] flex-col overflow-y-auto p-4 pt-0">
                    {activeTab && sectionId && (
                        <ProofWindow
                            activeTab={activeTab}
                            onRequestAuth={() => setActiveTab('auth')}
                            variant="embedded"
                            sectionId={sectionId}
                        />
                    )}
                </div>
            </UiSheetContent>
        </UiSheet>
    );
}
