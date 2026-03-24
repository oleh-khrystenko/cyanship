'use client';

import dynamic from 'next/dynamic';

const BriefDialog = dynamic(
    () => import('@/features/agency/brief/BriefDialog'),
);
const DeleteAccountDialog = dynamic(
    () => import('@/features/profile/DeleteAccountDialog'),
);
const TermsReacceptDialog = dynamic(
    () => import('@/features/auth/TermsReacceptDialog'),
);
const BillingResetDialog = dynamic(
    () => import('@/features/billing/BillingResetDialog'),
);

export function Overlays() {
    return (
        <>
            <BriefDialog />
            <DeleteAccountDialog />
            <TermsReacceptDialog />
            <BillingResetDialog />
        </>
    );
}
