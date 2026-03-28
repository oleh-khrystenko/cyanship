import { Readable } from 'stream';

export interface IAiProvider {
    streamChat(
        userMessage: string,
        systemPrompt: string,
        maxTokens: number,
        signal?: AbortSignal,
    ): Promise<Readable>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
