# AI Chat — Technical Implementation Plan

> **Goal:** Add a streaming AI chat to the dashboard, fully integrated with the existing executions billing system. Provider-agnostic architecture following the established `PAYMENT_PROVIDER` → `StripeService` pattern. Lifetime per-account AI limit with brief-form lead-gen gate for bonus requests. Persistent chat history in MongoDB.

---

## Architecture Overview

```
POST /ai/chat (text/event-stream)
  → JwtActiveGuard (existing)
  → OnboardingInterceptor (existing, global)
  → AiRateLimitGuard (new — lifetime account limit + Redis IP limit)
  → AiController.chat()
      → UsersService.spendExecutions(userId, 200, 'ai_chat')  // existing method
      → AiService.chat(userId, message)
          → Save user message to MongoDB
          → IAiProvider.streamChat(message, systemPrompt)  // injected provider
          → Save assistant message to MongoDB
          → Increment user.ai.requestsUsed
      → SSE: {type:"token"} → {type:"token"} → {type:"done", balanceAfter, aiRequestsRemaining}

GET /ai/chat/history
  → JwtActiveGuard
  → Returns saved ChatMessage[] for user

DELETE /ai/chat/history
  → JwtActiveGuard
  → Deletes all ChatMessage for user
```

### Module Dependency Map (new)

```
AppModule → AiModule → UsersModule (one-directional, no forwardRef)
                     → AgencyModule (for brief bonus integration)
                     → REDIS_CLIENT (existing provider)
                     → AI_PROVIDER injection token → AnthropicService
                     → ChatMessage schema (new MongoDB collection)
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

export interface AiChatTokenEvent {
    type: typeof AI_CHAT_EVENT.TOKEN;
    content: string;
}

export interface AiChatErrorEvent {
    type: typeof AI_CHAT_EVENT.ERROR;
    code: string;
}

export interface AiChatDoneEvent {
    type: typeof AI_CHAT_EVENT.DONE;
    balanceAfter: number;
    aiRequestsRemaining: number;
}

export type AiChatSSEEvent =
    | AiChatTokenEvent
    | AiChatErrorEvent
    | AiChatDoneEvent;

// --- Chat Message (persisted) ---

export const ChatMessageSchema = z.object({
    id: z.string(),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    createdAt: z.coerce.date(),
});

export type ChatMessageItem = z.infer<typeof ChatMessageSchema>;

export const ChatHistorySchema = z.object({
    messages: z.array(ChatMessageSchema),
});

export type ChatHistory = z.infer<typeof ChatHistorySchema>;

// --- AI Limits (user subdocument) ---

export interface UserAi {
    requestsUsed: number;
    bonusRequests: number;
}
```

### 1.3 Update `packages/types/src/agency/brief.ts`

Add optional field to `SubmitBriefSchema`:

```typescript
// Add to SubmitBriefSchema:
requestAiBonus: z.boolean().optional(),
```

### 1.4 Update `packages/types/src/entities/user.ts`

Add `ai` subdocument to user entity schema:

```typescript
ai: z.object({
    requestsUsed: z.number().int().min(0),
    bonusRequests: z.number().int().min(0),
}).nullable(),
```

### 1.5 Update `packages/types/src/contracts/index.ts`

Add export:
```typescript
export * from './ai-chat';
```

### 1.6 Rebuild types

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
├── schemas/
│   └── chat-message.schema.ts
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

### 2.4 Chat Message Schema

**File**: `apps/api/src/modules/ai/schemas/chat-message.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'chat_messages' })
export class ChatMessage extends Document {
    @Prop({ type: Types.ObjectId, required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: String, required: true, enum: ['user', 'assistant'] })
    role: 'user' | 'assistant';

    @Prop({ type: String, required: true })
    content: string;

    createdAt: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

// Compound index for efficient history queries
ChatMessageSchema.index({ userId: 1, createdAt: 1 });
```

### 2.5 Update User Schema

**File**: `apps/api/src/modules/users/schemas/user.schema.ts`

Add embedded `ai` subdocument (same pattern as `billing` and `executions`):

```typescript
@Prop({
    type: {
        requestsUsed: { type: Number, default: 0, min: 0 },
        bonusRequests: { type: Number, default: 0, min: 0 },
    },
    default: () => ({ requestsUsed: 0, bonusRequests: 0 }),
    _id: false,
})
ai: {
    requestsUsed: number;
    bonusRequests: number;
};
```

**Note**: Unlike `billing` (nullable, created on first event), `ai` has a default — every user starts with `{ requestsUsed: 0, bonusRequests: 0 }`. This avoids null checks everywhere.

### 2.6 AI Rate Limit Guard

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
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { REDIS_CLIENT } from '../../payments/providers/redis.provider';
import { User } from '../../users/schemas/user.schema';
import { ENV } from '../../../config/env';

@Injectable()
export class AiRateLimitGuard implements CanActivate {
    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        @InjectModel(User.name) private readonly userModel: Model<User>,
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

        // 1. Check lifetime account limit (MongoDB)
        const user = await this.userModel.findById(userId).select('ai').lean();
        if (!user) {
            throw new HttpException(
                { error: { code: 'USER_NOT_FOUND' } },
                HttpStatus.NOT_FOUND,
            );
        }

        const { requestsUsed, bonusRequests } = user.ai ?? { requestsUsed: 0, bonusRequests: 0 };
        const totalLimit = ENV.AI_CHAT_FREE_LIMIT + bonusRequests;

        if (requestsUsed >= totalLimit) {
            throw new HttpException(
                { error: { code: 'AI_LIMIT_EXHAUSTED' } },
                HttpStatus.FORBIDDEN,
            );
        }

        // 2. Check IP rate limit (Redis, 24h TTL)
        const ipKey = `ai:ip:${ip}`;
        const ipCount = await this.redis.incr(ipKey);
        if (ipCount === 1) {
            await this.redis.expire(ipKey, 86_400); // 24 hours
        }

        if (ipCount > ENV.AI_CHAT_IP_LIMIT) {
            throw new HttpException(
                { error: { code: 'AI_RATE_LIMIT_EXCEEDED' } },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        return true;
    }
}
```

**Key changes from v1**:
- **Account limit is lifetime** (MongoDB `ai.requestsUsed` vs `AI_CHAT_FREE_LIMIT + bonusRequests`), not Redis TTL
- **Two distinct error codes**: `AI_LIMIT_EXHAUSTED` (show brief form) vs `AI_RATE_LIMIT_EXCEEDED` (IP spam, retry later)
- User model injected for account limit check; Redis only for IP abuse prevention

### 2.7 DTO

**File**: `apps/api/src/modules/ai/dto/ai-chat.dto.ts`

```typescript
import { createZodDto } from '@anatine/zod-nestjs';
import { AiChatRequestSchema } from '@cyanship/types';

export class AiChatDto extends createZodDto(AiChatRequestSchema) {}
```

### 2.8 AI Service

**File**: `apps/api/src/modules/ai/ai.service.ts`

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Readable } from 'stream';
import {
    AI_PROVIDER,
    type IAiProvider,
} from './interfaces/ai-provider.interface';
import { ChatMessage } from './schemas/chat-message.schema';
import { User } from '../users/schemas/user.schema';
import { ENV } from '../../config/env';
import type { ChatMessageItem } from '@cyanship/types';

const SYSTEM_PROMPT = `You are a helpful AI assistant integrated into a SaaS platform demo.
Keep responses concise: 2-3 sentences maximum.
Be friendly but brief. Answer in the same language as the user's message.`;

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);

    constructor(
        @Inject(AI_PROVIDER)
        private readonly aiProvider: IAiProvider,
        @InjectModel(ChatMessage.name)
        private readonly chatMessageModel: Model<ChatMessage>,
        @InjectModel(User.name)
        private readonly userModel: Model<User>,
    ) {}

    /**
     * Save user message, stream AI response, save assistant message,
     * increment requestsUsed.
     * Returns: { stream, userMessageId } — caller handles SSE writing.
     */
    async processChat(
        userId: string,
        message: string,
    ): Promise<{ stream: Readable; userMessageId: string }> {
        // Save user message
        const userMsg = await this.chatMessageModel.create({
            userId: new Types.ObjectId(userId),
            role: 'user',
            content: message,
        });

        const stream = await this.aiProvider.streamChat(
            message,
            SYSTEM_PROMPT,
            ENV.AI_CHAT_MAX_TOKENS,
        );

        return { stream, userMessageId: userMsg._id.toString() };
    }

    /**
     * Called after stream completes successfully.
     * Saves assistant response and increments user's AI request counter.
     */
    async finalizeChat(
        userId: string,
        assistantContent: string,
    ): Promise<{ aiRequestsRemaining: number }> {
        // Save assistant message
        await this.chatMessageModel.create({
            userId: new Types.ObjectId(userId),
            role: 'assistant',
            content: assistantContent,
        });

        // Increment requestsUsed atomically
        const user = await this.userModel.findByIdAndUpdate(
            userId,
            { $inc: { 'ai.requestsUsed': 1 } },
            { new: true },
        );

        const totalLimit = ENV.AI_CHAT_FREE_LIMIT + (user?.ai?.bonusRequests ?? 0);
        const remaining = Math.max(0, totalLimit - (user?.ai?.requestsUsed ?? 0));

        return { aiRequestsRemaining: remaining };
    }

    /**
     * Load chat history for user.
     */
    async getHistory(userId: string): Promise<ChatMessageItem[]> {
        const messages = await this.chatMessageModel
            .find({ userId: new Types.ObjectId(userId) })
            .sort({ createdAt: 1 })
            .lean();

        return messages.map((m) => ({
            id: m._id.toString(),
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
        }));
    }

    /**
     * Clear chat history for user.
     */
    async clearHistory(userId: string): Promise<void> {
        await this.chatMessageModel.deleteMany({
            userId: new Types.ObjectId(userId),
        });
    }
}
```

**Why `processChat` + `finalizeChat` split**: Controller needs to stream tokens via `res.write()` between these two calls. Service saves user message before streaming (so it persists even if stream fails), and saves assistant message + increments counter only after stream completes successfully. If AI fails mid-stream, `requestsUsed` is NOT incremented — user doesn't lose a try.

### 2.9 AI Controller

**File**: `apps/api/src/modules/ai/ai.controller.ts`

```typescript
import {
    Body,
    Controller,
    Delete,
    Get,
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

        let assistantContent = '';

        try {
            // 3. Save user message + start AI stream
            const { stream } = await this.aiService.processChat(userId, dto.message);

            // 4. Stream AI response via SSE
            for await (const chunk of stream) {
                const text = chunk.toString();
                assistantContent += text;

                const event = {
                    type: AI_CHAT_EVENT.TOKEN,
                    content: text,
                };
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            }

            // 5. Save assistant message + increment requestsUsed
            const { aiRequestsRemaining } = await this.aiService.finalizeChat(
                userId,
                assistantContent,
            );

            // 6. Send done event with updated balance and remaining AI requests
            const doneEvent = {
                type: AI_CHAT_EVENT.DONE,
                balanceAfter: spendResult.balanceAfter,
                aiRequestsRemaining,
            };
            res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
        } catch (error) {
            this.logger.error('AI stream error', error);

            const errorEvent = {
                type: AI_CHAT_EVENT.ERROR,
                code: 'AI_PROVIDER_ERROR',
            };
            res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
        } finally {
            res.end();
        }
    }

    @Get('chat/history')
    @UseGuards(JwtActiveGuard)
    async getHistory(@CurrentUser('id') userId: string) {
        const messages = await this.aiService.getHistory(userId);
        return { data: { messages } };
    }

    @Delete('chat/history')
    @UseGuards(JwtActiveGuard)
    async clearHistory(@CurrentUser('id') userId: string) {
        await this.aiService.clearHistory(userId);
        return { data: { cleared: true } };
    }
}
```

**Key design decisions**:

1. **Executions deducted BEFORE AI call**: If AI fails after deduction, user loses executions but `requestsUsed` is NOT incremented (the try in `finalizeChat` only runs on success). Trade-off: user may lose 200 executions on provider failure, but keeps their AI request count. Acceptable for demo.

2. **`@Res()` manual response for SSE**: NestJS SSE decorator (`@Sse()`) works with GET + Observables. For POST + streaming, manual `res.write()` is standard. Bypasses `AllExceptionsFilter` after headers sent — hence try/catch with SSE error event.

3. **`assistantContent` accumulated in controller**: Controller collects full response text from stream, then passes to `finalizeChat()` for persistence. Alternative: collect in service — but service doesn't know about SSE, keeping it transport-agnostic.

4. **History endpoints are simple CRUD**: No pagination needed — chat history is short (max 5-10 messages per user). If needed later, add cursor-based pagination.

### 2.10 AI Module

**File**: `apps/api/src/modules/ai/ai.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AnthropicService } from './providers/anthropic.service';
import { aiProviderProvider } from './providers/ai-provider.provider';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { redisProvider } from '../payments/providers/redis.provider';

@Module({
    imports: [
        UsersModule,
        MongooseModule.forFeature([
            { name: ChatMessage.name, schema: ChatMessageSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [AiController],
    providers: [
        AiService,
        AnthropicService,
        aiProviderProvider,
        AiRateLimitGuard,
        redisProvider,
    ],
    exports: [AiService],
})
export class AiModule {}
```

**Note**: `User` schema registered here for guard's `@InjectModel(User.name)`. `redisProvider` re-registered (same pattern as PaymentsModule).

### 2.11 Register in AppModule

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

## Phase 3 — Backend: Brief-form AI Bonus

### 3.1 Update Brief Schema

**File**: `apps/api/src/modules/agency/schemas/brief.schema.ts`

Add field:
```typescript
@Prop({ type: Boolean, default: false })
requestAiBonus: boolean;
```

### 3.2 Update Brief Service

**File**: `apps/api/src/modules/agency/brief.service.ts`

After successful brief creation, if `requestAiBonus === true`:

```typescript
async submit(dto: SubmitBriefDto): Promise<{ code: string; aiBonusGranted?: boolean }> {
    const brief = await this.briefModel.create(dto);

    // Grant AI bonus if requested and user is authenticated
    let aiBonusGranted = false;
    if (dto.requestAiBonus && dto.userId) {
        await this.userModel.findByIdAndUpdate(dto.userId, {
            $inc: { 'ai.bonusRequests': ENV.AI_CHAT_BONUS_AMOUNT },
        });
        aiBonusGranted = true;
    }

    // Fire-and-forget emails (existing logic)
    this.sendEmails(brief);

    return { code: 'BRIEF_SUBMITTED', aiBonusGranted };
}
```

**Note**: `userId` is optional — brief form works for anonymous users on landing too. Only authenticated users get the bonus. The controller passes `userId` from `@CurrentUser()` if available.

### 3.3 Update Brief Controller

Add optional `@CurrentUser()` to pass userId when authenticated:

```typescript
@Post()
@SkipOnboarding()
async submit(
    @Body() dto: SubmitBriefDto,
    @Req() req: Request,
) {
    // userId is available if user is authenticated (optional)
    const userId = req.user?.id ?? null;
    const result = await this.briefService.submit({ ...dto, userId });
    return { data: result };
}
```

**Important**: Brief endpoint has `@SkipOnboarding()` and no auth guard — it works for anonymous users. When called from authenticated context (dashboard), the cookie/token is still sent, so `req.user` is populated by passport middleware. No auth guard added — backwards compatible.

---

## Phase 4 — Frontend: Chat UI

### 4.1 AI API Functions

**File**: `apps/web/src/shared/api/ai.ts`

```typescript
import { ENV } from '@/shared/config/env';
import { apiClient } from './client';
import { getAccessToken } from './client';
import type { AiChatSSEEvent, ChatMessageItem } from '@cyanship/types';

/**
 * Stream AI chat response via SSE.
 * Uses native fetch (not Axios) — Axios doesn't support ReadableStream.
 */
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

/**
 * Load saved chat history.
 */
export async function getChatHistory(): Promise<ChatMessageItem[]> {
    const { data } = await apiClient.get<{ data: { messages: ChatMessageItem[] } }>(
        '/ai/chat/history',
    );
    return data.data.messages;
}

/**
 * Clear chat history.
 */
export async function clearChatHistory(): Promise<void> {
    await apiClient.delete('/ai/chat/history');
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

### 4.2 Export `getAccessToken`

**File**: `apps/web/src/shared/api/client.ts`

Add getter for the in-memory access token:

```typescript
export function getAccessToken(): string | null {
    return accessToken;
}
```

Update `apps/web/src/shared/api/index.ts` to export it and ai module.

### 4.3 Chat Component

**File**: `apps/web/src/app/[locale]/(protected)/dashboard/components/AiChat.tsx`

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
    AI_CHAT_EVENT,
    AI_CHAT_MESSAGE_MAX_LENGTH,
    EXECUTION_ACTION_COST,
    EXECUTION_ACTION,
} from '@cyanship/types';
import type { AiChatSSEEvent, ChatMessageItem } from '@cyanship/types';
import {
    streamAiChat,
    getChatHistory,
    clearChatHistory,
    AiChatError,
} from '@/shared/api/ai';
import { getApiMessageKey } from '@/shared/api';
import { useAuthStore } from '@/stores/auth';
import { useBriefDialogStore } from '@/stores/briefDialog';
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
    const openBrief = useBriefDialogStore((s) => s.open);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLimitExhausted, setIsLimitExhausted] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const abortRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const cost = EXECUTION_ACTION_COST[EXECUTION_ACTION.AI_CHAT];
    const canAfford = (user?.executions.balance ?? 0) >= cost;

    // Load saved history on mount
    useEffect(() => {
        getChatHistory()
            .then((history) => {
                setMessages(
                    history.map((m) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                    })),
                );
            })
            .catch(() => {
                // Silent fail — empty chat is acceptable
            })
            .finally(() => setIsLoadingHistory(false));
    }, []);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const handleClearHistory = useCallback(async () => {
        await clearChatHistory();
        setMessages([]);
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
                            if (event.aiRequestsRemaining <= 0) {
                                setIsLimitExhausted(true);
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
                if (error.code === 'AI_LIMIT_EXHAUSTED') {
                    setIsLimitExhausted(true);
                } else if (error.code === 'AI_RATE_LIMIT_EXCEEDED') {
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
        <UiSectionCard
            title={t('heading')}
            headerRight={
                messages.length > 0 ? (
                    <button
                        onClick={handleClearHistory}
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        {t('clear_history')}
                    </button>
                ) : undefined
            }
        >
            {/* Messages area */}
            <div className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-background p-4">
                {isLoadingHistory ? (
                    <p className="text-center text-sm text-muted-foreground">...</p>
                ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">
                        {t('empty_state')}
                    </p>
                ) : null}

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

            {/* Input area OR brief-gate */}
            {isLimitExhausted ? (
                <div className="mt-3 rounded-lg border border-border bg-muted/50 p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        {t('limit_exhausted')}
                    </p>
                    <UiButton
                        variant="filled"
                        size="sm"
                        className="mt-2"
                        onClick={() => openBrief({ requestAiBonus: true })}
                    >
                        {t('request_bonus')}
                    </UiButton>
                </div>
            ) : (
                <div className="mt-3 flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        maxLength={AI_CHAT_MESSAGE_MAX_LENGTH}
                        placeholder={t('placeholder')}
                        disabled={isStreaming || !canAfford}
                        className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                    <UiButton
                        variant="filled"
                        size="sm"
                        disabled={isStreaming || !input.trim() || !canAfford}
                        onClick={handleSubmit}
                    >
                        {t('send')}
                    </UiButton>
                </div>
            )}

            {/* Cost info */}
            {!isLimitExhausted && (
                <p className="mt-2 text-xs text-muted-foreground">
                    {t('cost_info', { cost: String(cost) })}
                </p>
            )}
        </UiSectionCard>
    );
}
```

**Key changes from v1**:
- **History loading**: `useEffect` on mount fetches saved messages from API
- **Clear history button**: In `headerRight` of `UiSectionCard`
- **`isLimitExhausted` state**: Switches input area to brief-gate CTA
- **`aiRequestsRemaining` from done event**: Updates limit state
- **Brief dialog integration**: `openBrief({ requestAiBonus: true })` — passes flag to brief form

### 4.4 Brief Dialog Modifications

**Store update** (`apps/web/src/stores/briefDialog/briefDialogStore.ts`):

```typescript
interface BriefDialogState {
    isOpen: boolean;
    requestAiBonus: boolean;  // NEW
    open: (opts?: { requestAiBonus?: boolean }) => void;
    close: () => void;
}

export const useBriefDialogStore = create<BriefDialogState>((set) => ({
    isOpen: false,
    requestAiBonus: false,
    open: (opts) => set({ isOpen: true, requestAiBonus: opts?.requestAiBonus ?? false }),
    close: () => set({ isOpen: false, requestAiBonus: false }),
}));
```

**BriefForm modifications** (`apps/web/src/features/agency/brief/BriefForm.tsx`):

- Read `requestAiBonus` from brief dialog store
- Read `user` from auth store
- If `requestAiBonus && user`: set name field value to `getFullName(user)`, make it readonly/disabled
- Include `requestAiBonus: true` in the submit payload
- On success when `requestAiBonus`: update auth store with new AI limits, close dialog

### 4.5 Dashboard Integration

**File**: `apps/web/src/app/[locale]/(protected)/dashboard/page.tsx`

Add import and render **above** `SpendExecutionButtons`:

```typescript
import AiChat from './components/AiChat';

// In JSX, ABOVE SpendExecutionButtons:
{/* ── AI Chat ── */}
<AiChat onSpendSuccess={handleSpendSuccess} />

{/* ── Spend Execution Buttons ── */}
<SpendExecutionButtons onSpendSuccess={handleSpendSuccess} />
```

---

## Phase 5 — Translations (i18n)

### 5.1 English (`apps/web/messages/en.json`)

Add to `dashboard_page`:

```json
"ai_chat": {
    "heading": "AI Chat",
    "placeholder": "Ask AI anything...",
    "send": "Send",
    "clear_history": "Clear history",
    "empty_state": "Send a message to start a conversation with AI",
    "cost_info": "Each message costs {cost} executions",
    "error_rate_limit": "Too many requests. Try again later.",
    "limit_exhausted": "You've used all free AI requests. Fill out the form to get 5 more.",
    "request_bonus": "Get more AI requests"
}
```

Add to `errors`:

```json
"ai": {
    "ai_limit_exhausted": "AI request limit reached.",
    "ai_rate_limit_exceeded": "Too many requests. Try again later.",
    "ai_provider_error": "AI is temporarily unavailable. Please try again later."
}
```

Add to transactions action display:

```json
"ai_chat": "AI Chat"
```

### 5.2 Ukrainian (`apps/web/messages/uk.json`)

Mirror structure:

```json
"ai_chat": {
    "heading": "AI Чат",
    "placeholder": "Запитайте щось у AI...",
    "send": "Надіслати",
    "clear_history": "Очистити історію",
    "empty_state": "Напишіть повідомлення щоб розпочати розмову з AI",
    "cost_info": "Кожне повідомлення коштує {cost} executions",
    "error_rate_limit": "Забагато запитів. Спробуйте пізніше.",
    "limit_exhausted": "Безкоштовні AI-запити вичерпано. Заповніть форму щоб отримати ще 5.",
    "request_bonus": "Отримати більше AI-запитів"
}
```

```json
"ai": {
    "ai_limit_exhausted": "Ліміт AI-запитів вичерпано.",
    "ai_rate_limit_exceeded": "Забагато запитів. Спробуйте пізніше.",
    "ai_provider_error": "AI тимчасово недоступний. Спробуйте пізніше."
}
```

---

## Phase 6 — Environment & Configuration

### 6.1 Update `apps/api/src/config/env.ts`

Add new env vars:

```typescript
// AI
ANTHROPIC_API_KEY: getEnvVar('ANTHROPIC_API_KEY'),
AI_CHAT_MAX_TOKENS: parseInt(process.env.AI_CHAT_MAX_TOKENS ?? '150', 10),
AI_CHAT_IP_LIMIT: parseInt(process.env.AI_CHAT_IP_LIMIT ?? '5', 10),
AI_CHAT_FREE_LIMIT: parseInt(process.env.AI_CHAT_FREE_LIMIT ?? '5', 10),
AI_CHAT_BONUS_AMOUNT: parseInt(process.env.AI_CHAT_BONUS_AMOUNT ?? '5', 10),
```

**Note**: `ANTHROPIC_API_KEY` uses `getEnvVar()` (required, fail-fast). Tuning vars use `??` defaults — they have sane defaults and don't need to crash on missing.

### 6.2 Update `.env.example`

```env
# AI
ANTHROPIC_API_KEY=sk-ant-...
AI_CHAT_MAX_TOKENS=150        # optional, max tokens per AI response
AI_CHAT_IP_LIMIT=5            # optional, max requests per IP per 24h
AI_CHAT_FREE_LIMIT=5          # optional, free lifetime AI requests per account
AI_CHAT_BONUS_AMOUNT=5        # optional, bonus requests granted after brief form
```

### 6.3 Update `apps/api/src/test-setup.ts`

Add fallback for tests:

```typescript
process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key';
```

### 6.4 Install Anthropic SDK

```bash
pnpm --filter api add @anthropic-ai/sdk
```

---

## Phase 7 — Testing

### 7.1 Unit Tests

**File**: `apps/api/src/modules/ai/ai.service.spec.ts`

- Mock `AI_PROVIDER` with a fake `streamChat` that returns a Readable with known content
- Mock `ChatMessage` model
- Verify `processChat` saves user message and returns stream
- Verify `finalizeChat` saves assistant message and increments `ai.requestsUsed`
- Verify `getHistory` returns messages sorted by createdAt
- Verify `clearHistory` deletes all messages for user

**File**: `apps/api/src/modules/ai/guards/ai-rate-limit.guard.spec.ts`

- Mock `REDIS_CLIENT` and `User` model
- Test: first 5 requests pass (lifetime), 6th returns 403 `AI_LIMIT_EXHAUSTED`
- Test: user with `bonusRequests: 5` gets 10 total requests
- Test: IP limit (Redis) returns 429 after 5 requests from same IP
- Test: different IPs have separate counters
- Test: account limit and IP limit are independent

**File**: `apps/api/src/modules/ai/providers/anthropic.service.spec.ts`

- Mock `@anthropic-ai/sdk`
- Verify `messages.stream()` called with correct model and params
- Verify Readable emits correct chunks and ends

### 7.2 E2E Test

**File**: `apps/api/test/ai-chat.e2e-spec.ts`

- Override `AI_PROVIDER` with mock provider
- Test full flow: POST /ai/chat → auth → rate limit → spend → SSE stream → done event with `aiRequestsRemaining`
- Test: insufficient balance → 402
- Test: lifetime limit exceeded → 403 `AI_LIMIT_EXHAUSTED`
- Test: IP rate limit exceeded → 429
- Test: invalid message (empty, too long) → 400
- Test: SSE response format correct (`data: {...}\n\n`)
- Test: GET /ai/chat/history returns saved messages
- Test: DELETE /ai/chat/history clears messages
- Test: brief with `requestAiBonus: true` increments `ai.bonusRequests`

### 7.3 Frontend Tests

**File**: `apps/web/src/app/[locale]/(protected)/dashboard/components/AiChat.test.tsx`

- Mock `streamAiChat`, `getChatHistory`, `clearChatHistory`
- Test: renders empty state
- Test: loads history on mount
- Test: submitting message adds user + assistant messages
- Test: streaming tokens update assistant message
- Test: done event updates balance in auth store
- Test: done event with `aiRequestsRemaining: 0` shows brief-gate
- Test: error shows toast
- Test: input disabled during streaming
- Test: clear history button works

---

## MongoDB Collections (new)

### `chat_messages`

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `userId` | ObjectId | yes | Owner |
| `role` | String (enum) | — | `'user'` or `'assistant'` |
| `content` | String | — | Message text |
| `createdAt` | Date | compound with userId | Auto-managed |

**Compound index**: `{ userId: 1, createdAt: 1 }`

### User Schema Changes

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ai.requestsUsed` | Number | 0 | Lifetime AI request counter |
| `ai.bonusRequests` | Number | 0 | Bonus from brief forms |

### Brief Schema Changes

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `requestAiBonus` | Boolean | false | AI bonus request flag |

---

## Redis Key Schema

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `ai:ip:{ip}` | Integer (counter) | 86,400s (24h) | Per-IP request count (spam protection) |

**Removed from v1**: `ai:user:{userId}` — replaced by MongoDB `ai.requestsUsed` (lifetime, not TTL-based).

---

## New Response Codes

| Code | HTTP | When | Frontend action |
|------|------|------|-----------------|
| `AI_LIMIT_EXHAUSTED` | 403 | Lifetime account limit reached | Show brief-gate CTA |
| `AI_RATE_LIMIT_EXCEEDED` | 429 | IP limit exceeded | Toast "try again later" |
| `INSUFFICIENT_EXECUTIONS` | 402 | Not enough balance (existing) | Toast "insufficient executions" |
| `AI_PROVIDER_ERROR` | SSE event | AI provider failed mid-stream | Toast "AI unavailable" |

---

## API Endpoints (new)

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/ai/chat` | `JwtActiveGuard`, `AiRateLimitGuard` | Send message, stream SSE response |
| GET | `/ai/chat/history` | `JwtActiveGuard` | Load saved chat messages |
| DELETE | `/ai/chat/history` | `JwtActiveGuard` | Clear chat history |

---

## Dependency Order

```
Phase 1 (types)  ─── must be first, everything imports from @cyanship/types
    │
    ├── Phase 6 (env/config) ─── can be parallel with Phase 2
    │
    ├── Phase 2 (backend: AI module) ─── needs types for DTO + cost map
    │       │
    │       └── Phase 3 (backend: brief bonus) ─── needs AI module
    │
    ├── Phase 5 (i18n) ─── can be parallel with Phase 2
    │
    └── Phase 4 (frontend) ─── needs working API endpoints
            │
            └── Phase 7 (testing) ─── after all code
```

---

## Files Changed (Summary)

### New Files

| File | Purpose |
|------|---------|
| `apps/api/src/modules/ai/ai.module.ts` | Module registration |
| `apps/api/src/modules/ai/ai.controller.ts` | POST /ai/chat (SSE) + GET/DELETE history |
| `apps/api/src/modules/ai/ai.service.ts` | Chat orchestration + history CRUD |
| `apps/api/src/modules/ai/interfaces/ai-provider.interface.ts` | Provider contract + DI token |
| `apps/api/src/modules/ai/providers/ai-provider.provider.ts` | Provider factory |
| `apps/api/src/modules/ai/providers/anthropic.service.ts` | Anthropic SDK adapter |
| `apps/api/src/modules/ai/guards/ai-rate-limit.guard.ts` | Lifetime account + Redis IP limiter |
| `apps/api/src/modules/ai/schemas/chat-message.schema.ts` | Chat message MongoDB schema |
| `apps/api/src/modules/ai/dto/ai-chat.dto.ts` | Zod DTO |
| `packages/types/src/contracts/ai-chat.ts` | Shared contracts + message types |
| `apps/web/src/shared/api/ai.ts` | Frontend SSE client + history API |
| `apps/web/src/app/[locale]/(protected)/dashboard/components/AiChat.tsx` | Chat UI component |

### Modified Files

| File | Change |
|------|--------|
| `packages/types/src/contracts/executions.ts` | Add `AI_CHAT` action + cost |
| `packages/types/src/contracts/index.ts` | Export ai-chat |
| `packages/types/src/agency/brief.ts` | Add `requestAiBonus` field |
| `packages/types/src/entities/user.ts` | Add `ai` subdocument |
| `apps/api/src/app.module.ts` | Import `AiModule` |
| `apps/api/src/config/env.ts` | Add AI env vars |
| `apps/api/src/test-setup.ts` | Add AI env fallback |
| `apps/api/src/modules/users/schemas/user.schema.ts` | Add `ai` embedded subdocument |
| `apps/api/src/modules/agency/schemas/brief.schema.ts` | Add `requestAiBonus` field |
| `apps/api/src/modules/agency/brief.service.ts` | Grant AI bonus on brief submit |
| `apps/api/src/modules/agency/brief.controller.ts` | Pass userId to brief service |
| `apps/web/src/shared/api/client.ts` | Export `getAccessToken()` |
| `apps/web/src/shared/api/index.ts` | Export ai module |
| `apps/web/src/app/[locale]/(protected)/dashboard/page.tsx` | Add AiChat section above spend buttons |
| `apps/web/src/stores/briefDialog/briefDialogStore.ts` | Add `requestAiBonus` state |
| `apps/web/src/features/agency/brief/BriefForm.tsx` | Readonly name + AI bonus flag |
| `apps/web/messages/en.json` | AI chat + brief-gate translations |
| `apps/web/messages/uk.json` | AI chat + brief-gate translations |
| `.env.example` | AI env vars |

### New Dependencies

| Package | Workspace | Purpose |
|---------|-----------|---------|
| `@anthropic-ai/sdk` | `apps/api` | Anthropic API client |
