import { ReactNode } from 'react';
import { AuthGuard } from '@/features/auth';

interface ProtectedLayoutProps {
    children: ReactNode;
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
    return <AuthGuard>{children}</AuthGuard>;
}
