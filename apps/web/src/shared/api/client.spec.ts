import axios from 'axios';

jest.mock('@/shared/config', () => ({
    ENV: {
        NEXT_PUBLIC_API_URL: 'http://localhost:4000/api',
        NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
    },
}));

// Dynamic import mock for auth store clear on refresh failure
const mockClearUser = jest.fn();
jest.mock('@/stores/auth', () => ({
    useAuthStore: {
        getState: () => ({ clearUser: mockClearUser }),
    },
}));

import { apiClient, getAccessToken, setAccessToken } from './client';

describe('client', () => {
    beforeEach(() => {
        setAccessToken(null);
        mockClearUser.mockClear();
    });

    describe('token management', () => {
        it('setAccessToken stores token', () => {
            setAccessToken('test-token');
            expect(getAccessToken()).toBe('test-token');
        });

        it('getAccessToken returns stored token', () => {
            setAccessToken('abc');
            expect(getAccessToken()).toBe('abc');
        });

        it('setAccessToken(null) clears token', () => {
            setAccessToken('abc');
            setAccessToken(null);
            expect(getAccessToken()).toBeNull();
        });
    });

    describe('apiClient instance', () => {
        it('is created with correct baseURL', () => {
            expect(apiClient.defaults.baseURL).toBe(
                'http://localhost:4000/api'
            );
        });

        it('has withCredentials enabled', () => {
            expect(apiClient.defaults.withCredentials).toBe(true);
        });
    });

    describe('request interceptor', () => {
        it('adds Authorization header when token is set', async () => {
            setAccessToken('my-token');

            const handler =
                apiClient.interceptors.request.handlers![0]!.fulfilled!;
            const config = await handler({
                headers: new axios.AxiosHeaders(),
            } as any);

            expect(config.headers.Authorization).toBe('Bearer my-token');
        });

        it('does NOT add Authorization header when no token', async () => {
            setAccessToken(null);

            const handler =
                apiClient.interceptors.request.handlers![0]!.fulfilled!;
            const config = await handler({
                headers: new axios.AxiosHeaders(),
            } as any);

            expect(config.headers.Authorization).toBeUndefined();
        });
    });

    describe('response interceptor (401 auto-refresh)', () => {
        let mockAxiosPost: jest.SpyInstance;
        let handler: (error: any) => Promise<any>;

        beforeEach(() => {
            mockAxiosPost = jest.spyOn(axios, 'post');
            handler =
                apiClient.interceptors.response.handlers![0]!.rejected!;
        });

        afterEach(() => {
            mockAxiosPost.mockRestore();
        });

        const create401Error = (url: string, retry = false) => {
            const error: any = new Error('Unauthorized');
            error.response = { status: 401 };
            error.config = {
                url,
                _retry: retry,
                headers: new axios.AxiosHeaders(),
            };
            return error;
        };

        it('does NOT retry for /auth/refresh endpoint', async () => {
            const error = create401Error('/auth/refresh');

            await expect(handler(error)).rejects.toBeDefined();
            expect(mockAxiosPost).not.toHaveBeenCalled();
        });

        it('does NOT retry for /auth/logout endpoint', async () => {
            const error = create401Error('/auth/logout');

            await expect(handler(error)).rejects.toBeDefined();
            expect(mockAxiosPost).not.toHaveBeenCalled();
        });

        it('does NOT retry if already retried (_retry flag)', async () => {
            const error = create401Error('/some-endpoint', true);

            await expect(handler(error)).rejects.toBeDefined();
            expect(mockAxiosPost).not.toHaveBeenCalled();
        });

        it('does NOT retry for non-401 errors', async () => {
            const error: any = new Error('Server Error');
            error.response = { status: 500 };
            error.config = {
                url: '/some-endpoint',
                headers: new axios.AxiosHeaders(),
            };

            await expect(handler(error)).rejects.toBeDefined();
            expect(mockAxiosPost).not.toHaveBeenCalled();
        });

        it('does NOT retry if config is missing', async () => {
            const error: any = new Error('Error');
            error.config = undefined;

            await expect(handler(error)).rejects.toBeDefined();
        });

        it('on refresh success → stores new token and retries with Bearer', async () => {
            mockAxiosPost.mockResolvedValueOnce({
                data: { data: { accessToken: 'new-token-123' } },
            });

            // Mock adapter to prevent real network request on retry
            const originalAdapter = apiClient.defaults.adapter;
            apiClient.defaults.adapter = () =>
                Promise.resolve({
                    data: { ok: true },
                    status: 200,
                    statusText: 'OK',
                    headers: {},
                    config: {} as any,
                });

            const error = create401Error('/users/me');
            await handler(error);

            expect(mockAxiosPost).toHaveBeenCalledWith(
                'http://localhost:4000/api/auth/refresh',
                null,
                { withCredentials: true }
            );
            expect(getAccessToken()).toBe('new-token-123');

            apiClient.defaults.adapter = originalAdapter;
        });

        it('on refresh failure → clears token and auth store', async () => {
            mockAxiosPost.mockRejectedValueOnce(
                new Error('Refresh failed')
            );

            const error = create401Error('/users/me');

            await expect(handler(error)).rejects.toBeDefined();

            expect(getAccessToken()).toBeNull();

            // Wait for dynamic import to resolve
            await new Promise((r) => setTimeout(r, 10));
            expect(mockClearUser).toHaveBeenCalled();
        });
    });
});
