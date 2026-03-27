# AI Chat — Technical Implementation Plan

> **Goal:** Add a streaming AI chat to the dashboard, fully integrated with the existing executions billing system. Provider-agnostic architecture following the established `PAYMENT_PROVIDER` → `StripeService` pattern.

---

## Architecture Overview

```
POST /ai/chat (text/event-stream)
  → JwtActiveGuard (existing)
  → OnboardingInterceptor (existing, global)
  → AiRateLimitGuard (new, Redis-based)
  → AiController.chat()
      → UsersService.spendExecutions(userId, 200, 'ai_chat')  // existing method
      → AiService.chat(message)
          → IAiProvider.streamChat(message, systemPrompt)  // injected provider
      → SSE: {type:"token"} → {type:"token"} → {type:"done", balanceAfter}
```

### Module Dependency Map (new)

```
AppModule → AiModule → UsersModule (forwardRef NOT needed — one-directional)
                     → REDIS_CLIENT (existing provider)
                     → AI_PROVIDER injection token → AnthropicService
```

---

## Phase 1 — Shared Types (`packages/types`)

### 1.1 Update `packages/types/src/contracts/executions.ts`

Add new action and cost:

```typescript
// In EXECUTION_ACTION — add to Debit section:
AI_CHAT: 'ai_chat',

// In SPENDABLE_ACTIONS — add:
EXECUTION_ACTION.AI_CHAT,

// In EXECUTION_ACTION_COST — add:
[EXECUTION_ACTION.AI_CHAT]: 200,
```

Update `SpendableAction` type — automatic since `SPENDABLE_ACTIONS` is `as const`.

### 1.2 Create `packages/types/src/contracts/ai-chat.ts`

```typescript
import { z } from 'zod';

// --- Request ---

export const AI_CHAT_MESSAGE_MAX_LENGTH = 500;

export const AiChatRequestSchema = z.object({
    message: z
        .string()
        .trim()
        .min(1)
        .max(AI_CHAT_MESSAGE_MAX_LENGTH),
});

export type AiChatRequest = z.infer<typeof AiChatRequestSchema>;

// --- SSE Event Types ---

export const AI_CHAT_EVENT = {
    TOKEN: 'token',
    ERROR: 'error',
    DONE: 'done',
} as const;

export type AiChatEvent = (typeof AI_CHAT_EVENT)[keyof typeof AI_CHAT_EVENT];

// Token event: partial text chunk
export interface AiChatTokenEvent {
    type: typeof AI_CHAT_EVENT.TOKEN;
    content: string;
}

// Error event: something went wrong mid-stream
export interface AiChatErrorEvent {
    type: typeof AI_CHAT_EVENT.ERROR;
    code: string;
}

// Done event: stream finished successfully
export interface AiChatDoneEvent {
    type: typeof AI_CHAT_EVENT.DONE;
    balanceAfter: number;
}

export type AiChatSSEEvent =
    | AiChatTokenEvent
    | AiChatErrorEvent
    | AiChatDoneEvent;

// --- Rate Limit Config ---

export const AI_CHAT_DEFAULTS = {
    MAX_TOKENS: 150,
    IP_LIMIT: 5,
    USER_LIMIT: 5,
    LIMIT_WINDOW_SEC: 86_400, // 24 hours
    EXECUTION_COST: 200,
} as const;
```

### 1.3 Update `packages/types/src/contracts/index.ts`

Add export:
```typescript
export * from './ai-chat';
```

### 1.4 Rebuild types

```bash
pnpm --filter @cyanship/types build
```

---

## Phase 2 — Backend: AI Module

### File Structure

```
apps/api/src/modules/ai/
├── ai.module.ts
├── ai.controller.ts
├── ai.service.ts
├── interfaces/
│   └── ai-provider.interface.ts
├── providers/
│   ├── ai-provider.provider.ts
│   └── anthropic.service.ts
├── guards/
│   └── ai-rate-limit.guard.ts
└── dto/
    └── ai-chat.dto.ts
```

### 2.1 AI Provider Interface

**File**: `apps/api/src/modules/ai/interfaces/ai-provider.interface.ts`

```typescript
import { Readable } from 'stream';

export interface IAiProvider {
    /**
     * Stream a chat response for the given user message.
     * Returns a Readable that emits string chunks (partial text).
     * The stream ends naturally when the response is complete.
     */
    streamChat(
        userMessage: string,
        systemPrompt: string,
        maxTokens: number,
    ): Promise<Readable>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
```

**Design note**: Returns Node.js `Readable` stream — provider-agnostic. Anthropic SDK returns its own stream type, OpenAI returns a different one. Each adapter wraps the provider-specific stream into a standard `Readable`. The controller doesn't care what's upstream.

### 2.2 Anthropic Service (Default Provider)

**File**: `apps/api/src/modules/ai/providers/anthropic.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';
import { IAiProvider } from '../interfaces/ai-provider.interface';
import { ENV } from '../../../config/env';

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
    ): Promise<Readable> {
        const stream = this.client.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
        });

        // Wrap Anthropic's stream into a standard Node.js Readable
        const readable = new Readable({
            read() {},  // push-based, no pull needed
        });

        stream.on('text', (text) => {
            readable.push(text);
        });

        stream.on('end', () => {
            readable.push(null);  // signal end of stream
        });

        stream.on('error', (err) => {
            readable.destroy(err);
        });

        return readable;
    }
}
```

**Model choice**: `claude-haiku-4-5-20251001` — cheapest Anthropic model, ~$0.80/M input, ~$4/M output. At max_tokens=150, worst case ~$0.0006 per request.

**Why own SDK instance** (like CatalogService): Avoids circular DI. Simple constructor instantiation with env key.

### 2.3 Provider Factory

**File**: `apps/api/src/modules/ai/providers/ai-provider.provider.ts`

```typescript
import { Provider } from '@nestjs/common';
import { AI_PROVIDER } from '../interfaces/ai-provider.interface';
import { AnthropicService } from './anthropic.service';

export const aiProviderProvider: Provider = {
    provide: AI_PROVIDER,
    useClass: AnthropicService,
};
```

**Swap provider**: To switch to OpenAI — create `OpenAiService implements IAiProvider`, change `useClass` here. Zero changes elsewhere.

### 2.4 AI Rate Limit Guard

**File**: `apps/api/src/modules/ai/guards/ai-rate-limit.guard.ts`

```typescript
import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../payments/providers/redis.provider';
import { ENV } from '../../../config/env';

@Injectable()
export class AiRateLimitGuard implements CanActivate {
    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const userId: string = request.user?.id;
        const ip: string = request.ip;

        if (!userId || !ip) {
            throw new HttpException(
                { error: { code: 'UNAUTHORIZED' } },
                HttpStatus.UNAUTHORIZED,
            );
        }

        // Check both limits in parallel
        const [ipAllowed, userAllowed] = await Promise.all([
            this.checkLimit(`ai:ip:${ip}`, ENV.AI_CHAT_IP_LIMIT),
            this.checkLimit(`ai:user:${userId}`, ENV.AI_CHAT_USER_LIMIT),
        ]);

        if (!ipAllowed || !userAllowed) {
            throw new HttpException(
                { error: { code: 'AI_RATE_LIMIT_EXCEEDED' } },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        return true;
    }

    /**
     * Atomic increment + TTL set via Redis MULTI.
     * Returns false if limit exceeded.
     *
     * Pattern: INCR key → if result === 1, EXPIRE key TTL
     * This ensures TTL is set exactly once (on first request).
     */
    private async checkLimit(key: string, limit: number): Promise<boolean> {
        const current = await this.redis.incr(key);

        // First request — set TTL
        if (current === 1) {
            await this.redis.expire(key, ENV.AI_CHAT_LIMIT_WINDOW_SEC);
        }

        return current <= limit;
    }
}
```

**Fail-closed behavior**: If Redis throws — exception propagates → 500 → request blocked. No silent pass-through.

**Why not `@SkipThrottle()`**: This guard is separate from the global `ThrottlerGuard`. Global throttler (60/min) still applies. AI guard adds per-feature limits on top.

### 2.5 DTO

**File**: `apps/api/src/modules/ai/dto/ai-chat.dto.ts`

```typescript
import { createZodDto } from '@anatine/zod-nestjs';
import { AiChatRequestSchema } from '@cyanship/types';

export class AiChatDto extends createZodDto(AiChatRequestSchema) {}
```

### 2.6 AI Service

**File**: `apps/api/src/modules/ai/ai.service.ts`

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import {
    AI_PROVIDER,
    type IAiProvider,
} from './interfaces/ai-provider.interface';
import { ENV } from '../../config/env';

const SYSTEM_PROMPT = `You are a helpful AI assistant integrated into a SaaS platform demo.
Keep responses concise: 2-3 sentences maximum.
Be friendly but brief. Answer in the same language as the user's message.`;

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);

    constructor(
        @Inject(AI_PROVIDER)
        private readonly aiProvider: IAiProvider,
    ) {}

    async streamChat(message: string): Promise<Readable> {
        this.logger.debug(`Streaming chat response for message: "${message.slice(0, 50)}..."`);

        return this.aiProvider.streamChat(
            message,
            SYSTEM_PROMPT,
            ENV.AI_CHAT_MAX_TOKENS,
        );
    }
}
```

**Why service wraps provider**: Single place for system prompt, logging, future middleware (e.g., content moderation). Controller stays thin.

### 2.7 AI Controller

**File**: `apps/api/src/modules/ai/ai.controller.ts`

```typescript
import {
    Body,
    Controller,
    HttpException,
    HttpStatus,
    Logger,
    Post,
    Res,
    UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
    AI_CHAT_EVENT,
    EXECUTION_ACTION,
    EXECUTION_ACTION_COST,
    type SpendableAction,
} from '@cyanship/types';
import { JwtActiveGuard } from '../../common/guards/jwt-active.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';
import { AiService } from './ai.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { UsersService } from '../users/users.service';

@Controller('ai')
export class AiController {
    private readonly logger = new Logger(AiController.name);

    constructor(
        private readonly aiService: AiService,
        private readonly usersService: UsersService,
    ) {}

    @Post('chat')
    @UseGuards(JwtActiveGuard, AiRateLimitGuard)
    async chat(
        @CurrentUser('id') userId: string,
        @Body() dto: AiChatDto,
        @Res() res: Response,
    ): Promise<void> {
        // 1. Spend executions (atomic, existing mechanism)
        const cost = EXECUTION_ACTION_COST[EXECUTION_ACTION.AI_CHAT as SpendableAction];
        const spendResult = await this.usersService.spendExecutions(
            userId,
            cost,
            EXECUTION_ACTION.AI_CHAT,
        );

        if (!spendResult) {
            throw new HttpException(
                { error: { code: 'INSUFFICIENT_EXECUTIONS' } },
                HttpStatus.PAYMENT_REQUIRED,
            );
        }

        // 2. Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        res.flushHeaders();

        try {
            // 3. Stream AI response
            const stream = await this.aiService.streamChat(dto.message);

            for await (const chunk of stream) {
                const event = {
                    type: AI_CHAT_EVENT.TOKEN,
                    content: chunk.toString(),
                };
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            }

            // 4. Send done event with updated balance
            const doneEvent = {
                type: AI_CHAT_EVENT.DONE,
                balanceAfter: spendResult.balanceAfter,
            };
            res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
        } catch (error) {
            this.logger.error('AI stream error', error);

            // Send error event through SSE (connection already open)
            const errorEvent = {
                type: AI_CHAT_EVENT.ERROR,
                code: 'AI_PROVIDER_ERROR',
            };
            res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
        } finally {
            res.end();
        }
    }
}
```

**Key design decisions**:

1. **Executions deducted BEFORE AI call**: If AI fails after deduction, user loses executions. This is intentional for demo — keeps billing logic simple and atomic. In production, you'd consider refund logic. For a boilerplate demo with $0.0004 per request, acceptable trade-off.

2. **`@Res()` manual response**: NestJS SSE decorator (`@Sse()`) works with GET + Observables. For POST + streaming, manual `res.write()` is standard pattern. Bypasses NestJS response interceptors — `AllExceptionsFilter` won't catch errors after headers are sent, hence try/catch with SSE error event.

3. **Error mid-stream**: If AI provider fails after streaming starts, we send an `error` event via SSE (not HTTP error, since headers already sent). Frontend handles this gracefully.

### 2.8 AI Module

**File**: `apps/api/src/modules/ai/ai.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AnthropicService } from './providers/anthropic.service';
import { aiProviderProvider } from './providers/ai-provider.provider';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';
import { redisProvider } from '../payments/providers/redis.provider';

@Module({
    imports: [UsersModule],
    controllers: [AiController],
    providers: [
        AiService,
        AnthropicService,
        aiProviderProvider,
        AiRateLimitGuard,
        redisProvider,
    ],
})
export class AiModule {}
```

**Note**: `redisProvider` is re-registered here (same pattern as PaymentsModule). Each module gets its own Redis instance via factory. Alternative: make Redis global. Current approach matches existing codebase pattern.

### 2.9 Register in AppModule

**File**: `apps/api/src/app.module.ts`

Add import:
```typescript
import { AiModule } from './modules/ai/ai.module';

@Module({
    imports: [
        // ... existing modules
        AiModule,
    ],
})
```

---

## Phase 3 — Frontend: Chat UI

### 3.1 AI API Function

**File**: `apps/web/src/shared/api/ai.ts`

```typescript
import { ENV } from '@/shared/config/env';
import type { AiChatSSEEvent } from '@cyanship/types';

/**
 * Send a chat message and stream the AI response via SSE.
 *
 * Uses native fetch (not Axios) because Axios doesn't support
 * ReadableStream for response body parsing.
 *
 * @param message - User message text
 * @param onEvent - Callback for each SSE event
 * @param signal - AbortController signal for cancellation
 */
export async function streamAiChat(
    message: string,
    onEvent: (event: AiChatSSEEvent) => void,
    signal?: AbortSignal,
): Promise<void> {
    const response = await fetch(`${ENV.NEXT_PUBLIC_API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        credentials: 'include',
        signal,
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        const code = body?.error?.code ?? 'UNKNOWN';
        throw new AiChatError(code, response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new AiChatError('NO_STREAM', 0);

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            const match = line.match(/^data:\s*(.+)$/);
            if (!match) continue;

            try {
                const event: AiChatSSEEvent = JSON.parse(match[1]);
                onEvent(event);
            } catch {
                // Ignore malformed events
            }
        }
    }
}

export class AiChatError extends Error {
    constructor(
        public readonly code: string,
        public readonly status: number,
    ) {
        super(`AI Chat error: ${code}`);
        this.name = 'AiChatError';
    }
}
```

**Why fetch, not Axios**: Axios doesn't support `response.body.getReader()` for streaming. Native fetch with `ReadableStream` is the standard approach for SSE consumption from POST endpoints.

**Auth token**: Uses `credentials: 'include'` to send cookies. However, the API uses Bearer token in memory. Need to attach token manually:

```typescript
// In the fetch call, add Authorization header:
headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAccessToken()}`,
},
```

This requires exposing `getAccessToken()` from the API client module. Check existing `client.ts` — the token is stored in module scope. Add a getter export:

```typescript
// In shared/api/client.ts — add:
export function getAccessToken(): string | null {
    return accessToken;
}
```

### 3.2 Chat Component

**File**: `apps/web/src/app/[locale]/(protected)/dashboard/components/AiChat.tsx`

```typescript
'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AI_CHAT_EVENT, AI_CHAT_MESSAGE_MAX_LENGTH } from '@cyanship/types';
import type { AiChatSSEEvent } from '@cyanship/types';
import { streamAiChat, AiChatError } from '@/shared/api/ai';
import { getApiMessageKey } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';
import UiButton from '@/shared/ui/UiButton';
import UiSectionCard from '@/shared/ui/UiSectionCard';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface AiChatProps {
    onSpendSuccess?: () => void;
}

export default function AiChat({ onSpendSuccess }: AiChatProps) {
    const t = useTranslations('dashboard_page.ai_chat');
    const tGlobal = useTranslations();

    const user = useAuthStore((s) => s.user);
    const setUser = useAuthStore((s) => s.setUser);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const handleSubmit = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed || isStreaming) return;

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: trimmed,
        };

        const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        setInput('');
        setIsStreaming(true);

        const abort = new AbortController();
        abortRef.current = abort;

        try {
            await streamAiChat(
                trimmed,
                (event: AiChatSSEEvent) => {
                    switch (event.type) {
                        case AI_CHAT_EVENT.TOKEN:
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantMsg.id
                                        ? { ...m, content: m.content + event.content }
                                        : m,
                                ),
                            );
                            scrollToBottom();
                            break;

                        case AI_CHAT_EVENT.DONE:
                            if (user) {
                                setUser({
                                    ...user,
                                    executions: {
                                        ...user.executions,
                                        balance: event.balanceAfter,
                                    },
                                });
                            }
                            onSpendSuccess?.();
                            break;

                        case AI_CHAT_EVENT.ERROR:
                            toast.error(
                                tGlobal(getApiMessageKey(event.code, 'ai')),
                            );
                            break;
                    }
                },
                abort.signal,
            );
        } catch (error) {
            if (error instanceof AiChatError) {
                if (error.code === 'AI_RATE_LIMIT_EXCEEDED') {
                    toast.error(t('error_rate_limit'));
                } else if (error.code === 'INSUFFICIENT_EXECUTIONS') {
                    toast.error(
                        tGlobal(getApiMessageKey(error.code, 'users')),
                    );
                } else {
                    toast.error(
                        tGlobal(getApiMessageKey(error.code)),
                    );
                }

                // Remove empty assistant message on pre-stream error
                setMessages((prev) =>
                    prev.filter((m) => m.id !== assistantMsg.id),
                );
            }
            // AbortError is expected on unmount — ignore
        } finally {
            setIsStreaming(false);
            abortRef.current = null;
        }
    }, [input, isStreaming, user, setUser, t, tGlobal, onSpendSuccess, scrollToBottom]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit],
    );

    return (
        <UiSectionCard title={t('heading')}>
            {/* Messages area */}
            <div className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-background p-4">
                {messages.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground">
                        {t('empty_state')}
                    </p>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                                msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-foreground'
                            }`}
                        >
                            {msg.content || (
                                <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-current opacity-40" />
                            )}
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="mt-3 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={AI_CHAT_MESSAGE_MAX_LENGTH}
                    placeholder={t('placeholder')}
                    disabled={isStreaming}
                    className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
                <UiButton
                    variant="filled"
                    size="sm"
                    disabled={isStreaming || !input.trim()}
                    onClick={handleSubmit}
                >
                    {t('send')}
                </UiButton>
            </div>

            {/* Cost info */}
            <p className="mt-2 text-xs text-muted-foreground">
                {t('cost_info', { cost: '200' })}
            </p>
        </UiSectionCard>
    );
}
```

**Component design notes**:
- Stateless chat — messages live in `useState`, lost on navigation (by design for demo)
- `AbortController` for cleanup on unmount (prevents memory leaks, state updates on unmounted component)
- Empty assistant message appears immediately with pulse animation → fills as tokens arrive
- Existing `UiSectionCard` and `UiButton` — no new UI primitives needed
- `onSpendSuccess` callback triggers `TransactionHistory` refresh (same pattern as `SpendExecutionButtons`)

### 3.3 Dashboard Integration

**File**: `apps/web/src/app/[locale]/(protected)/dashboard/page.tsx`

Add import and render between `SpendExecutionButtons` and `TransactionHistory`:

```typescript
import AiChat from './components/AiChat';

// In JSX, between SpendExecutionButtons and TransactionHistory:
{/* ── AI Chat ── */}
<AiChat onSpendSuccess={handleSpendSuccess} />
```

### 3.4 Export `getAccessToken`

**File**: `apps/web/src/shared/api/client.ts`

Add getter for the in-memory access token:

```typescript
export function getAccessToken(): string | null {
    return accessToken;
}
```

Update `apps/web/src/shared/api/index.ts` to export it.

---

## Phase 4 — Translations (i18n)

### 4.1 English (`apps/web/messages/en.json`)

Add to `dashboard_page`:

```json
"ai_chat": {
    "heading": "AI Chat",
    "placeholder": "Ask AI anything...",
    "send": "Send",
    "empty_state": "Send a message to start a conversation with AI",
    "cost_info": "Each message costs {cost} executions",
    "error_rate_limit": "AI chat limit reached. Try again in 24 hours."
}
```

Add to `errors`:

```json
"ai": {
    "ai_rate_limit_exceeded": "AI chat limit reached. Try again in 24 hours.",
    "ai_provider_error": "AI is temporarily unavailable. Please try again later."
}
```

Add to transactions action display (if exists, for transaction history labels):

```json
"ai_chat": "AI Chat"
```

### 4.2 Ukrainian (`apps/web/messages/uk.json`)

Mirror structure:

```json
"ai_chat": {
    "heading": "AI Чат",
    "placeholder": "Запитайте щось у AI...",
    "send": "Надіслати",
    "empty_state": "Напишіть повідомлення щоб розпочати розмову з AI",
    "cost_info": "Кожне повідомлення коштує {cost} executions",
    "error_rate_limit": "Ліміт AI чату вичерпано. Спробуйте через 24 години."
}
```

```json
"ai": {
    "ai_rate_limit_exceeded": "Ліміт AI чату вичерпано. Спробуйте через 24 години.",
    "ai_provider_error": "AI тимчасово недоступний. Спробуйте пізніше."
}
```

---

## Phase 5 — Environment & Configuration

### 5.1 Update `apps/api/src/config/env.ts`

Add new env vars:

```typescript
// AI
ANTHROPIC_API_KEY: getEnvVar('ANTHROPIC_API_KEY'),
AI_CHAT_MAX_TOKENS: parseInt(process.env.AI_CHAT_MAX_TOKENS ?? '150', 10),
AI_CHAT_IP_LIMIT: parseInt(process.env.AI_CHAT_IP_LIMIT ?? '5', 10),
AI_CHAT_USER_LIMIT: parseInt(process.env.AI_CHAT_USER_LIMIT ?? '5', 10),
AI_CHAT_LIMIT_WINDOW_SEC: parseInt(process.env.AI_CHAT_LIMIT_WINDOW_SEC ?? '86400', 10),
```

**Note**: `ANTHROPIC_API_KEY` uses `getEnvVar()` (required, fail-fast). Tuning vars use `??` defaults — they have sane defaults and don't need to crash on missing.

### 5.2 Update `.env.example`

```env
# AI
ANTHROPIC_API_KEY=sk-ant-...
AI_CHAT_MAX_TOKENS=150        # optional, default 150
AI_CHAT_IP_LIMIT=5            # optional, max requests per IP per window
AI_CHAT_USER_LIMIT=5          # optional, max requests per user per window
AI_CHAT_LIMIT_WINDOW_SEC=86400 # optional, rate limit window (24h)
```

### 5.3 Update `apps/api/src/test-setup.ts`

Add fallback for tests:

```typescript
process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key';
```

### 5.4 Install Anthropic SDK

```bash
pnpm --filter api add @anthropic-ai/sdk
```

---

## Phase 6 — Testing

### 6.1 Unit Tests

**File**: `apps/api/src/modules/ai/ai.service.spec.ts`

- Mock `AI_PROVIDER` with a fake `streamChat` that returns a Readable with known content
- Verify `streamChat` is called with correct system prompt and max_tokens

**File**: `apps/api/src/modules/ai/guards/ai-rate-limit.guard.spec.ts`

- Mock `REDIS_CLIENT`
- Test: first 5 requests pass, 6th returns 429
- Test: different IPs have separate counters
- Test: different users have separate counters
- Test: both IP and user limits enforced independently

**File**: `apps/api/src/modules/ai/providers/anthropic.service.spec.ts`

- Mock `@anthropic-ai/sdk`
- Verify `messages.stream()` called with correct model and params
- Verify Readable emits correct chunks and ends

### 6.2 E2E Test

**File**: `apps/api/test/ai-chat.e2e-spec.ts`

- Override `AI_PROVIDER` with mock provider
- Test full flow: POST /ai/chat → auth → rate limit → spend → SSE stream
- Test: insufficient balance → 402
- Test: rate limit exceeded → 429
- Test: invalid message (empty, too long) → 400
- Test: SSE response format is correct (`data: {...}\n\n`)

### 6.3 Frontend Tests

**File**: `apps/web/src/app/[locale]/(protected)/dashboard/components/AiChat.test.tsx`

- Mock `streamAiChat` function
- Test: renders empty state
- Test: submitting message adds user + assistant messages
- Test: streaming tokens update assistant message
- Test: done event updates balance in auth store
- Test: error shows toast
- Test: input disabled during streaming

---

## Redis Key Schema

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `ai:ip:{ip}` | Integer (counter) | 86,400s (24h) | Per-IP request count |
| `ai:user:{userId}` | Integer (counter) | 86,400s (24h) | Per-user request count |

---

## New Response Codes

| Code | HTTP | When |
|------|------|------|
| `AI_RATE_LIMIT_EXCEEDED` | 429 | IP or user limit exceeded |
| `INSUFFICIENT_EXECUTIONS` | 402 | Not enough balance (existing) |
| `AI_PROVIDER_ERROR` | SSE event | AI provider failed mid-stream |

---

## Dependency Order

```
Phase 1 (types)  ─── must be first, everything imports from @cyanship/types
    │
    ├── Phase 5 (env/config) ─── can be parallel with Phase 2
    │
    ├── Phase 2 (backend) ─── needs types for DTO + cost map
    │       │
    │       └── Phase 6.1-6.2 (API tests) ─── after backend code
    │
    ├── Phase 4 (i18n) ─── can be parallel with Phase 2
    │
    └── Phase 3 (frontend) ─── needs working API endpoint for integration testing
            │
            └── Phase 6.3 (frontend tests) ─── after frontend code
```

---

## Files Changed (Summary)

### New Files
| File | Purpose |
|------|---------|
| `apps/api/src/modules/ai/ai.module.ts` | Module registration |
| `apps/api/src/modules/ai/ai.controller.ts` | POST /ai/chat SSE endpoint |
| `apps/api/src/modules/ai/ai.service.ts` | Chat orchestration |
| `apps/api/src/modules/ai/interfaces/ai-provider.interface.ts` | Provider contract + DI token |
| `apps/api/src/modules/ai/providers/ai-provider.provider.ts` | Provider factory |
| `apps/api/src/modules/ai/providers/anthropic.service.ts` | Anthropic SDK adapter |
| `apps/api/src/modules/ai/guards/ai-rate-limit.guard.ts` | Redis rate limiter |
| `apps/api/src/modules/ai/dto/ai-chat.dto.ts` | Zod DTO |
| `packages/types/src/contracts/ai-chat.ts` | Shared contracts |
| `apps/web/src/shared/api/ai.ts` | Frontend SSE client |
| `apps/web/src/app/[locale]/(protected)/dashboard/components/AiChat.tsx` | Chat UI component |

### Modified Files
| File | Change |
|------|--------|
| `packages/types/src/contracts/executions.ts` | Add `AI_CHAT` action + cost |
| `packages/types/src/contracts/index.ts` | Export ai-chat |
| `apps/api/src/app.module.ts` | Import `AiModule` |
| `apps/api/src/config/env.ts` | Add AI env vars |
| `apps/api/src/test-setup.ts` | Add AI env fallback |
| `apps/web/src/shared/api/client.ts` | Export `getAccessToken()` |
| `apps/web/src/shared/api/index.ts` | Export ai module |
| `apps/web/src/app/[locale]/(protected)/dashboard/page.tsx` | Add AiChat section |
| `apps/web/messages/en.json` | AI chat translations |
| `apps/web/messages/uk.json` | AI chat translations |
| `.env.example` | AI env vars |

### New Dependencies
| Package | Workspace | Purpose |
|---------|-----------|---------|
| `@anthropic-ai/sdk` | `apps/api` | Anthropic API client |
