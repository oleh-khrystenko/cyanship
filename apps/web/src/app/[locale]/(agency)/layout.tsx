import { ReactNode } from 'react';
import { LandingNav } from '@/features/agency/landing-nav';

interface AgencyLayoutProps {
    children: ReactNode;
}

export default function AgencyLayout({ children }: AgencyLayoutProps) {
    return (
        <>
            <LandingNav />
            {children}
        </>
    );
}
