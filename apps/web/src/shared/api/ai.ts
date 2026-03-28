import type { ChatMessageItem, AiChatSSEEvent } from '@cyanship/types';

import { apiClient, getAccessToken } from './client';
import { ENV } from '@/shared/config';

export class AiChatError extends Error {
    constructor(
        public readonly code: string,
        public readonly status: number,
    ) {
        super(`AI Chat error: ${code} (${status})`);
        this.name = 'AiChatError';
    }
}

export async function streamAiChat(
    message: string,
    onEvent: (event: AiChatSSEEvent) => void,
    signal?: AbortSignal,
): Promise<void> {
    const token = getAccessToken();

    const response = await fetch(`${ENV.NEXT_PUBLIC_API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ message }),
        signal,
        credentials: 'include',
    });

    if (!response.ok) {
        let code = 'INTERNAL_ERROR';
        try {
            const body = await response.json();
            code = body?.error?.code ?? body?.code ?? code;
        } catch {
            // ignore parse errors
        }
        throw new AiChatError(code, response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;

                const json = trimmed.slice(5).trim();
                if (!json) continue;

                try {
                    const event = JSON.parse(json) as AiChatSSEEvent;
                    onEvent(event);
                } catch {
                    // ignore malformed events
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export async function getChatHistory(): Promise<ChatMessageItem[]> {
    const { data } = await apiClient.get<{
        data: { messages: ChatMessageItem[] };
    }>('/ai/chat/history');
    return data.data.messages;
}

export async function clearChatHistory(): Promise<void> {
    await apiClient.delete('/ai/chat/history');
}
