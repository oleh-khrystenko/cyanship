import { logout } from '@/shared/api';

import { useAuthStore } from './authStore';

interface SignOutOptions {
    /** Path to navigate to after the session is cleared. Omit to stay in place. */
    redirectTo?: string;
}

/**
 * The single exit path from an authenticated session.
 *
 * Returns whether the server confirmed the sign-out. Client state is dropped
 * only on confirmation, because the session lives in the httpOnly `bid_refresh`
 * cookie and only the server response can clear it. Clearing local state after
 * a failed request would produce the worst outcome: the user sees a signed-out
 * app, the cookie survives, and `AuthInitializer` silently restores the session
 * on the next page load. Reporting the failure instead keeps client and server
 * in agreement and lets the caller offer a retry.
 *
 * The wait is bounded — `logout` carries its own request timeout — so this call
 * always settles and callers may block their UI on it. Failures are limited to
 * network, timeout and server errors: `/auth/logout` carries no guard, so an
 * expired access token does not break it.
 *
 * Navigation goes through `window.location` rather than the router: a full
 * reload guarantees no authenticated state survives in memory.
 */
export async function signOut({
    redirectTo,
}: SignOutOptions = {}): Promise<boolean> {
    try {
        await logout();
    } catch {
        return false;
    }

    useAuthStore.getState().clearUser();

    if (redirectTo) {
        window.location.assign(redirectTo);
    }

    return true;
}
