import { ReactNode } from 'react';
import { LandingNav } from '@/features/agency/landing-nav';
import { BriefDialog } from '@/features/agency/brief';
import { SourceTracker } from '@/features/agency/brief/ui/SourceTracker';

interface AgencyLayoutProps {
    children: ReactNode;
}

export default function AgencyLayout({ children }: AgencyLayoutProps) {
    return (
        <>
            <SourceTracker />
            <LandingNav />
            <BriefDialog />
            {children}
        </>
    );
}
