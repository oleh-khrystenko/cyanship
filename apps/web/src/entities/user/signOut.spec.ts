const mockLogout = jest.fn();

jest.mock('@/shared/api', () => ({
    logout: mockLogout,
}));

import { useAuthStore } from './authStore';
import { signOut } from './signOut';

const mockUser = {
    id: '507f1f77bcf86cd799439011',
    email: 'test@gmail.com',
    profile: { firstName: 'John', lastName: 'Doe' },
    executions: { balance: 0, freeReportUsed: false },
    hasPassword: true,
    deletedAt: null,
    preferredLang: 'uk' as const,
};

describe('signOut', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthStore.getState().setUser(mockUser);
    });

    // Navigation itself is not asserted: jsdom's `window.location` is
    // non-configurable and its `assign` is a read-only no-op stub.

    it('calls the API and clears the store', async () => {
        mockLogout.mockResolvedValue(undefined);

        await expect(signOut()).resolves.toBe(true);

        expect(mockLogout).toHaveBeenCalled();
        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('reports failure and keeps the session when the API call fails', async () => {
        mockLogout.mockRejectedValue(new Error('timeout'));

        // Only the server response clears the httpOnly refresh cookie, so a
        // failed logout must not leave a signed-out client on a live session.
        await expect(signOut()).resolves.toBe(false);

        expect(useAuthStore.getState().user).not.toBeNull();
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
});
