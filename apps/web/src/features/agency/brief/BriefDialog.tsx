'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    UiModal,
    UiModalTrigger,
    UiModalContent,
    UiModalHeader,
    UiModalTitle,
} from '@/shared/ui/UiModal';
import BriefForm from './BriefForm';

interface BriefDialogProps {
    children: React.ReactNode;
}

export default function BriefDialog({ children }: BriefDialogProps) {
    const t = useTranslations('brief_form');
    const [open, setOpen] = useState(false);

    return (
        <UiModal open={open} onOpenChange={setOpen}>
            <UiModalTrigger asChild>{children}</UiModalTrigger>
            <UiModalContent>
                <UiModalHeader>
                    <UiModalTitle>{t('title')}</UiModalTitle>
                </UiModalHeader>
                <div className="px-4 pb-6">
                    <BriefForm onSuccess={() => setOpen(false)} />
                </div>
            </UiModalContent>
        </UiModal>
    );
}
