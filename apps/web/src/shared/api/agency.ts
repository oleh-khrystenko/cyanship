import { apiClient } from './client';
import type { SubmitBrief } from '@cyanship/types/agency';

export async function submitBrief(
    data: SubmitBrief,
): Promise<{ code: string }> {
    const { data: response } = await apiClient.post<{
        data: null;
        code: string;
    }>('/agency/brief', data);
    return { code: response.code };
}
