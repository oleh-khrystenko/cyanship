import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';

import { ENV } from '../../../config/env';
import type { IAiProvider } from '../interfaces/ai-provider.interface';

@Injectable()
export class AnthropicService implements IAiProvider {
    private readonly client: Anthropic;

    constructor() {
        this.client = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY });
    }

    async streamChat(
        userMessage: string,
        systemPrompt: string,
        maxTokens: number,
        signal?: AbortSignal,
    ): Promise<Readable> {
        const messageStream = this.client.messages.stream(
            {
                model: 'claude-haiku-4-5-20251001',
                max_tokens: maxTokens,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
            },
            { signal },
        );

        const readable = new Readable({
            objectMode: true,
            read() {},
        });

        messageStream.on('text', (text) => {
            readable.push(text);
        });

        messageStream.on('end', () => {
            readable.push(null);
        });

        messageStream.on('error', (err) => {
            readable.destroy(err);
        });

        return readable;
    }
}
