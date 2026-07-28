import { ReactNode } from 'react';
import { Header } from '@/widgets/header';
import { AuthGuard } from '@/features/auth';

interface ProtectedLayoutProps {
    children: ReactNode;
}

// These screens render per-user state behind `AuthGuard` and read query params
// on the client; there is nothing to prerender, so keep the group dynamic
// instead of scattering Suspense boundaries across each page.
export const dynamic = 'force-dynamic';

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
    return (
        <>
            <Header />
            <AuthGuard>{children}</AuthGuard>
        </>
    );
}
