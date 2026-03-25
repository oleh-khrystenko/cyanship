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
const MobileMenuSheet = dynamic(
    () => import('@/widgets/header/MobileMenuSheet'),
);
const DogfoodingSheet = dynamic(
    () => import('@/widgets/agency/landing/DogfoodingSection/DogfoodingSheet'),
);

export function Overlays() {
    return (
        <>
            <BriefDialog />
            <DeleteAccountDialog />
            <TermsReacceptDialog />
            <BillingResetDialog />
            <MobileMenuSheet />
            <DogfoodingSheet />
        </>
    );
}
