import { ReactNode } from 'react';
import AuthShell from './AuthShell';

// Every auth screen reads one-time tokens or status flags out of the query
// string on the client, so prerendering them would ship a shell that bails to
// client rendering on arrival anyway. Declaring the group dynamic states that
// intent in one place — the layout has to stay a server module for the config
// to be picked up, hence the split with `AuthShell`.
export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: ReactNode }) {
    return <AuthShell>{children}</AuthShell>;
}
