'use client';

import dynamic from 'next/dynamic';

const BriefDialog = dynamic(
    () => import('@/features/agency/brief/BriefDialog')
);
const DeleteAccountDialog = dynamic(
    () => import('@/features/profile/DeleteAccountDialog')
);
const AvatarUploadDialog = dynamic(
    () => import('@/features/profile/AvatarUploadDialog')
);
const AvatarDeleteConfirmDialog = dynamic(
    () => import('@/features/profile/AvatarDeleteConfirmDialog')
);
const TermsReacceptDialog = dynamic(
    () => import('@/features/auth/TermsReacceptDialog')
);
const BillingResetDialog = dynamic(
    () => import('@/features/billing/BillingResetDialog')
);
const MobileMenuSheet = dynamic(
    () => import('@/widgets/header/MobileMenuSheet')
);
const ProofSheet = dynamic(
    () => import('@/widgets/agency/proof-window/ProofSheet')
);
const PortfolioCaseDialog = dynamic(
    () => import('@/widgets/agency/portfolio/PortfolioCaseDialog')
);

export function Overlays() {
    return (
        <>
            <BriefDialog />
            <DeleteAccountDialog />
            <AvatarUploadDialog />
            <AvatarDeleteConfirmDialog />
            <TermsReacceptDialog />
            <BillingResetDialog />
            <MobileMenuSheet />
            <ProofSheet />
            <PortfolioCaseDialog />
        </>
    );
}
