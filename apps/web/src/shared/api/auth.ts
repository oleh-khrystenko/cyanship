import type { AuthResponse, UserProfile } from '@bidguard/types';

import { apiClient, setAccessToken } from './client';

export async function sendMagicLink(email: string): Promise<void> {
    await apiClient.post('/auth/magic-link/send', { email });
}

export async function verifyMagicLink(token: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<{ data: AuthResponse }>(
        '/auth/magic-link/verify',
        { token }
    );

    setAccessToken(data.data.accessToken);
    return data.data;
}

export async function refreshToken(): Promise<string> {
    const { data } = await apiClient.post<{
        data: { accessToken: string };
    }>('/auth/refresh');

    setAccessToken(data.data.accessToken);
    return data.data.accessToken;
}

export async function logout(): Promise<void> {
    await apiClient.post('/auth/logout');
    setAccessToken(null);
}

export async function getMe(): Promise<UserProfile> {
    const { data } = await apiClient.get<{ data: UserProfile }>('/users/me');
    return data.data;
}
