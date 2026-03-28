# AI Chat — Technical Implementation Plan

> **Goal:** Add a streaming AI chat to the dashboard, fully integrated with the existing executions billing system. Provider-agnostic architecture following the established `PAYMENT_PROVIDER` → `StripeService` pattern. Lifetime per-account AI limit with brief-form lead-gen gate for bonus requests. Persistent chat history in MongoDB. Executions deducted only after successful AI response.

---

## Architecture Overview

### Request Flow

```
POST /ai/chat (text/event-stream)
  → JwtActiveGuard (existing)
  → OnboardingInterceptor (existing, global)
  → AiRateLimitGuard (new — lifetime account limit from MongoDB + Redis IP limit)
  → AiController.chat()
      → Check executions balance (sufficient? don't deduct yet)
      → IAiProvider.streamChat(message, systemPrompt)  // injected provider
      → SSE stream: {type:"token"} → {type:"token"} → ...
      → On success:
          → Save both user + assistant messages to MongoDB
          → Single atomic MongoDB update: $inc executions.balance -200 AND $inc ai.requestsUsed +1 (with balance $gte guard)
          → SSE: {type:"done", balanceAfter, aiRequestsRemaining}
      → On AI failure:
          → SSE: {type:"error", code:"AI_PROVIDER_ERROR"}
          → Nothing saved, nothing deducted, no try spent

GET /ai/chat/history → JwtActiveGuard → Returns ChatMessage[] for user
DELETE /ai/chat/history → JwtActiveGuard → Deletes all ChatMessage for user
```

### Module Dependency Map

```
AppModule → AiModule → UsersModule (one-directional, no forwardRef needed)
                     → REDIS_CLIENT (existing provider from `common/providers/redis.provider.ts`)
                     → AI_PROVIDER injection token → AnthropicService
                     → ChatMessage schema (new MongoDB collection)
                     → User schema (for guard + ai.requestsUsed increment)

AppModule → AgencyModule (existing) → User schema (for ai.bonusRequests increment)
```

`redisProvider` already lives in `apps/api/src/common/providers/redis.provider.ts` — shared infrastructure, imported by PaymentsModule and AuthModule.

---

## Phase 1 — Shared Types (`packages/types`)

### 1.1 Update `packages/types/src/contracts/executions.ts`

- Add `AI_CHAT: 'ai_chat'` to `EXECUTION_ACTION` (Debit section)
- Do NOT add to `SPENDABLE_ACTIONS` — `ai_chat` is an internal action used only by the AI module, not exposed through the general `POST /users/me/executions/spend` endpoint. This prevents users from calling the spend endpoint with `action: 'ai_chat'` directly (bypassing AI guards, creating fake transactions)

### 1.2 Create `packages/types/src/contracts/ai-chat.ts`

Define and export:
- `AI_CHAT_COST = 200` — single source of truth for AI chat execution cost (used by AI module for deduction, frontend for display)
- `AI_CHAT_MESSAGE_MAX_LENGTH = 500`
- `AiChatRequestSchema` — Zod schema: `{ message: string, trimmed, min 1, max 500 }`
- `AiChatRequest` — inferred type
- `AI_CHAT_EVENT` — const object: `TOKEN`, `ERROR`, `DONE`
- SSE event interfaces: `AiChatTokenEvent` (`{ type, content }`), `AiChatErrorEvent` (`{ type, code }`), `AiChatDoneEvent` (`{ type, balanceAfter, aiRequestsRemaining }`)
- `AiChatSSEEvent` — union of the three event types
- `ChatMessageSchema` — Zod schema for persisted message: `{ id, role: 'user'|'assistant', content, createdAt }`
- `ChatMessageItem` — inferred type
- `ChatHistorySchema` — `{ messages: ChatMessageItem[] }`

### 1.3 Update `packages/types/src/agency/brief.ts`

Add optional field to `SubmitBriefSchema`:
- `requestAiBonus: z.boolean().optional()`
- `userId` is NOT in the schema — it's set server-side from JWT `req.user`, never trusted from client body

### 1.4 Update `packages/types/src/entities/user.ts`

Add `ai` subdocument to user entity Zod schema:
- `ai: z.object({ requestsUsed: z.number().int().min(0), bonusRequests: z.number().int().min(0) }).nullable()`
- Nullable because existing users won't have this field until first AI interaction (Mongoose default handles new users)

### 1.5 Update `packages/types/src/contracts/index.ts`

Add export: `export * from './ai-chat'`

### 1.6 Rebuild: `pnpm --filter @cyanship/types build`

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

### 2.1 AI Provider Interface (`interfaces/ai-provider.interface.ts`)

- Interface `IAiProvider` with single method: `streamChat(userMessage: string, systemPrompt: string, maxTokens: number): Promise<Readable>`
- Returns standard Node.js `Readable` — provider-agnostic. Each adapter wraps provider-specific stream into `Readable`
- Export `AI_PROVIDER = Symbol('AI_PROVIDER')` — DI injection token

### 2.2 Anthropic Service (`providers/anthropic.service.ts`)

- `@Injectable()`, implements `IAiProvider`
- Constructor creates own Anthropic SDK instance with `ENV.ANTHROPIC_API_KEY` (same pattern as `CatalogService` creating own Stripe instance to avoid circular DI)
- Model: `claude-haiku-4-5-20251001`
- `streamChat()`: calls `client.messages.stream(...)`, wraps into `Readable` by listening to `text`, `end`, `error` events
- System prompt hardcoded in `AiService`, not here — provider is a dumb transport

### 2.3 Provider Factory (`providers/ai-provider.provider.ts`)

- `{ provide: AI_PROVIDER, useClass: AnthropicService }` — exact same pattern as `paymentProviderProvider`
- To swap to OpenAI/Gemini: create new service implementing `IAiProvider`, change `useClass` here. Zero changes elsewhere

### 2.4 Chat Message Schema (`schemas/chat-message.schema.ts`)

- Mongoose `@Schema({ timestamps: true, collection: 'chat_messages' })`
- Fields: `userId` (ObjectId, required, indexed), `role` (String enum `['user', 'assistant']`, required), `content` (String, required), `createdAt` (Date, auto)
- Compound index: `{ userId: 1, createdAt: 1 }`

### 2.5 Update User Schema (`apps/api/src/modules/users/schemas/user.schema.ts`)

- Add embedded `ai` subdocument: `{ requestsUsed: Number (default 0, min 0), bonusRequests: Number (default 0, min 0) }`
- `default: () => ({ requestsUsed: 0, bonusRequests: 0 })`, `_id: false`
- Same pattern as existing `executions` subdocument
- Existing users without this field: guard uses `?? { requestsUsed: 0, bonusRequests: 0 }` fallback

### 2.6 AI Rate Limit Guard (`guards/ai-rate-limit.guard.ts`)

- Implements `CanActivate`
- Injects: `REDIS_CLIENT` (Redis), `User` model (Mongoose)
- Check 1 — Lifetime account limit (MongoDB): load `user.ai`, check `requestsUsed < ENV.AI_CHAT_FREE_LIMIT + bonusRequests`. If exceeded → throw 403 `AI_LIMIT_EXHAUSTED`
- Check 2 — IP rate limit (Redis): `INCR ai:ip:{ip}`, set TTL 86400 on first request, check against `ENV.AI_CHAT_IP_LIMIT`. If exceeded → throw 429 `AI_RATE_LIMIT_EXCEEDED`
- Two distinct error codes so frontend knows: `AI_LIMIT_EXHAUSTED` → show brief-gate, `AI_RATE_LIMIT_EXCEEDED` → toast "try later"
- Fail-closed: Redis error propagates as 500 → request blocked

### 2.7 DTO (`dto/ai-chat.dto.ts`)

- `createZodDto(AiChatRequestSchema)` — standard project pattern

### 2.8 AI Service (`ai.service.ts`)

- Injects: `AI_PROVIDER`, `ChatMessage` model, `User` model
- System prompt constant: "You are a helpful AI assistant... Keep responses concise: 2-3 sentences maximum. Answer in the same language as the user's message."
- `processChat(userId, message)`: calls `aiProvider.streamChat()` → returns `{ stream }` (user message is NOT saved yet — saved only on success to avoid orphaned messages)
- `finalizeChat(userId, userMessage, assistantContent)`: saves both user + assistant messages to DB → single atomic `findOneAndUpdate` with `{ $inc: { 'executions.balance': -AI_CHAT_COST, 'ai.requestsUsed': 1 } }` and guard `'executions.balance': { $gte: AI_CHAT_COST }` → returns `{ balanceAfter, aiRequestsRemaining }`
- `getHistory(userId)`: find messages sorted by `createdAt: 1`, map to `ChatMessageItem[]`
- `clearHistory(userId)`: `deleteMany({ userId })`
- **Critical**: `finalizeChat` only called on successful stream completion. If AI fails mid-stream — nothing is persisted, nothing deducted (both messages saved only on success)

### 2.9 AI Controller (`ai.controller.ts`)

- `@Controller('ai')`
- `POST /chat` — `@UseGuards(JwtActiveGuard, AiRateLimitGuard)`:
  1. Check executions balance sufficient (read-only check, no deduction)
  2. Set SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`
  3. Call `aiService.processChat()` — starts stream (messages NOT saved yet)
  4. Loop `for await (chunk of stream)` → `res.write(JSON.stringify(tokenEvent))`
  5. Accumulate `assistantContent` from chunks
  6. On stream end: call `aiService.finalizeChat(userId, userMessage, assistantContent)` → saves both messages + atomic deduction → send done event with `balanceAfter` and `aiRequestsRemaining`
  7. On stream error: send error SSE event, do NOT call `finalizeChat` (nothing saved, nothing deducted)
  8. `res.end()` in finally block
- `GET /chat/history` — `@UseGuards(JwtActiveGuard)`: returns `{ data: { messages } }`
- `DELETE /chat/history` — `@UseGuards(JwtActiveGuard)`: clears history, returns `{ data: { cleared: true } }`
- Uses `@Res()` manual response for SSE (NestJS `@Sse()` is for GET + Observables, not POST + streaming)

### 2.10 AI Module (`ai.module.ts`)

- Imports: `UsersModule`, `MongooseModule.forFeature([ChatMessage, User])`
- Providers: `AiService`, `AnthropicService`, `aiProviderProvider`, `AiRateLimitGuard`, `redisProvider`
- Controllers: `AiController`
- No exports needed — no other module depends on AiService

### 2.11 Register in AppModule

- Add `AiModule` to `imports` array in `apps/api/src/app.module.ts`

---

## Phase 3 — Backend: Brief-form AI Bonus

Modifies existing `AgencyModule` — no new module created.

### 3.1 Update Brief Schema (`apps/api/src/modules/agency/schemas/brief.schema.ts`)

- Add `requestAiBonus: Boolean, default false`
- Add `userId: String, default null` (optional — set server-side from JWT, null for anonymous brief from landing)

### 3.2 Update Brief Service (`apps/api/src/modules/agency/services/brief.service.ts`)

- After successful brief creation: if `requestAiBonus === true && userId` (from controller) → `userModel.findByIdAndUpdate(userId, { $inc: { 'ai.bonusRequests': ENV.AI_CHAT_BONUS_AMOUNT } })`
- Return `aiBonusGranted: boolean` in response so frontend knows to refresh AI limits
- AgencyModule needs User model access: add `MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])` to AgencyModule imports if not already present

### 3.3 Brief Controller (`apps/api/src/modules/agency/brief.controller.ts`)

- When `requestAiBonus === true`: require valid JWT. Use optional JWT extraction — if JWT present and valid, take `userId` from `req.user._id`; if no JWT, ignore `requestAiBonus` (treat as regular anonymous brief). This prevents spoofing: only authenticated user can grant themselves bonus
- `userId` NEVER comes from request body — always from `req.user` (JWT)
- Existing landing page brief form continues working unchanged (no JWT → no bonus, no userId)

---

## Phase 4 — Frontend: Chat UI

### 4.1 AI API Functions (`apps/web/src/shared/api/ai.ts`)

- `streamAiChat(message, onEvent, signal?)`: uses native `fetch` (not Axios — no streaming support). Sends POST with Bearer token from `getAccessToken()`. Parses SSE `data:` lines, calls `onEvent` callback for each parsed event
- `getChatHistory()`: standard Axios GET `/ai/chat/history` → returns `ChatMessageItem[]`
- `clearChatHistory()`: Axios DELETE `/ai/chat/history`
- `AiChatError` class with `code` and `status` for pre-stream HTTP errors
- Uses existing `getAccessToken()` already exported from `apps/web/src/shared/api/client.ts`

### 4.2 Chat Component (`apps/web/src/app/[locale]/(protected)/dashboard/components/AiChat.tsx`)

State:
- `messages: ChatMessage[]` — local state, hydrated from API on mount
- `input: string`, `isStreaming: boolean`, `isLimitExhausted: boolean`, `isLoadingHistory: boolean`
- `AbortController` ref for cleanup on unmount

On mount:
- `getChatHistory()` → populate messages, set `isLoadingHistory: false`

On submit:
- Add user message + empty assistant message to state
- Call `streamAiChat()` with callbacks:
  - `TOKEN` → append content to assistant message
  - `DONE` → update `authStore.user.executions.balance`, check `aiRequestsRemaining`, call `onSpendSuccess()`
  - `ERROR` → toast via `getApiMessageKey()`
- On `AiChatError` (pre-stream): handle `AI_LIMIT_EXHAUSTED` (set `isLimitExhausted`), `AI_RATE_LIMIT_EXCEEDED` (toast), `INSUFFICIENT_EXECUTIONS` (toast)

UI structure (uses existing `UiSectionCard`, `UiButton`):
- Header: title + "Clear history" button (when messages exist)
- Messages area: scrollable container, user messages right-aligned (primary bg), assistant left-aligned (muted bg), empty state text, loading pulse for streaming
- Footer: input + send button (or brief-gate when exhausted)
- Cost info text below input

### 4.3 Brief-gate (limit exhausted)

When `isLimitExhausted`:
- Replace input area with message + CTA button
- Button calls `useBriefDialogStore.open({ requestAiBonus: true })`

Brief dialog store modifications (`apps/web/src/stores/briefDialog/briefDialogStore.ts`):
- Add `requestAiBonus: boolean` to state (default false)
- `open(opts?)` sets `requestAiBonus` from opts
- `close()` resets `requestAiBonus` to false

BriefForm modifications (`apps/web/src/features/agency/brief/BriefForm.tsx`):
- Read `requestAiBonus` from brief dialog store, `user` from auth store
- If `requestAiBonus && user`: render name and email as plain text (`<p>`/`<span>`, not input fields). Pass `requestAiBonus: true` in submit payload (no `userId` — server gets it from JWT). Name and email NOT sent to server — server knows them by userId from JWT
- On success when `requestAiBonus`: refresh auth store (getMe), close dialog — this rehydrates AI limits

### 4.4 Dashboard Integration (`apps/web/src/app/[locale]/(protected)/dashboard/page.tsx`)

- Import `AiChat` component
- Render **above** `SpendExecutionButtons`, after `SubscriptionStatus`
- Pass `onSpendSuccess={handleSpendSuccess}` (same pattern as SpendExecutionButtons)

---

## Phase 5 — Translations (i18n)

### English (`apps/web/messages/en.json`)

Add `dashboard_page.ai_chat`:
- `heading`, `placeholder`, `send`, `clear_history`, `empty_state`, `cost_info` (with `{cost}` param)
- `error_rate_limit`, `limit_exhausted`, `request_bonus`

Add `errors.ai`:
- `ai_limit_exhausted`, `ai_rate_limit_exceeded`, `ai_provider_error`

Add transaction action label for `ai_chat`

### Ukrainian (`apps/web/messages/uk.json`)

Mirror all keys above with Ukrainian translations.

---

## Phase 6 — Environment & Configuration

### `apps/api/src/config/env.ts`

- `ANTHROPIC_API_KEY`: `getEnvVar()` — required, fail-fast
- `AI_CHAT_MAX_TOKENS`: `parseInt(process.env.AI_CHAT_MAX_TOKENS ?? '300', 10)` — optional with default (300 tokens ≈ 150–200 words)
- `AI_CHAT_IP_LIMIT`: default 5
- `AI_CHAT_FREE_LIMIT`: default 5
- `AI_CHAT_BONUS_AMOUNT`: default 5

### `.env.example`

Add AI section with all vars and comments.

### `apps/api/src/test-setup.ts`

Add: `process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key'`

### Install SDK

`pnpm --filter api add @anthropic-ai/sdk`

---

## Phase 7 — Testing

### Unit Tests (API)

`ai.service.spec.ts`:
- Mock `AI_PROVIDER`, `ChatMessage` model, `User` model
- `processChat`: calls AI provider, returns stream (no DB writes yet)
- `finalizeChat`: saves both user + assistant messages, single atomic update: deducts executions + increments `requestsUsed`
- `getHistory`: returns sorted messages
- `clearHistory`: deletes all messages for user

`ai-rate-limit.guard.spec.ts`:
- Mock `REDIS_CLIENT`, `User` model
- First 5 requests pass (lifetime), 6th returns 403 `AI_LIMIT_EXHAUSTED`
- User with `bonusRequests: 5` gets 10 total
- IP limit returns 429 after exceeding
- Account and IP limits are independent

`anthropic.service.spec.ts`:
- Mock `@anthropic-ai/sdk`
- Verify `messages.stream()` called with correct model/params
- Verify Readable emits chunks and ends

### E2E Tests (API)

`test/ai-chat.e2e-spec.ts`:
- Override `AI_PROVIDER` with mock
- Full flow: POST → auth → rate limit → stream → deduct → done event
- Insufficient balance → 402 (nothing deducted)
- Lifetime limit exceeded → 403 `AI_LIMIT_EXHAUSTED`
- AI provider failure → error SSE event, nothing deducted
- GET history returns saved messages, DELETE clears them
- Brief with `requestAiBonus: true` + JWT auth increments `ai.bonusRequests` (userId from req.user)

### Frontend Tests

`AiChat.test.tsx`:
- Mock `streamAiChat`, `getChatHistory`, `clearChatHistory`
- Renders empty state, loads history on mount
- Submit adds messages, streaming updates assistant
- Done event updates balance, `aiRequestsRemaining: 0` shows brief-gate
- Error shows toast, input disabled during streaming

---

## Database Changes

### New Collection: `chat_messages`

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| `userId` | ObjectId | compound | Message owner |
| `role` | String enum | — | `'user'` or `'assistant'` |
| `content` | String | — | Message text |
| `createdAt` | Date | compound | Auto-managed by timestamps |

Compound index: `{ userId: 1, createdAt: 1 }`

### User Schema: new `ai` subdocument

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `ai.requestsUsed` | Number | 0 | Lifetime AI request counter |
| `ai.bonusRequests` | Number | 0 | Bonus granted via brief forms |

### Brief Schema: new fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `requestAiBonus` | Boolean | false | AI bonus request flag |
| `userId` | String | null | Authenticated user ID (set server-side from JWT, never from client) |

---

## Redis Key Schema

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `ai:ip:{ip}` | Integer (counter) | 86,400s (24h) | Per-IP request count (spam protection) |

---

## Response Codes

| Code | HTTP | When | Frontend Action |
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

## Files Changed

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
| `packages/types/src/contracts/executions.ts` | Add `AI_CHAT` action (debit only, NOT in SPENDABLE_ACTIONS) |
| `packages/types/src/contracts/index.ts` | Export ai-chat |
| `packages/types/src/agency/brief.ts` | Add `requestAiBonus` field (no `userId` — server-side from JWT) |
| `packages/types/src/entities/user.ts` | Add `ai` subdocument |
| `apps/api/src/app.module.ts` | Import `AiModule` |
| `apps/api/src/config/env.ts` | Add AI env vars |
| `apps/api/src/test-setup.ts` | Add AI env fallback |
| `apps/api/src/modules/users/schemas/user.schema.ts` | Add `ai` embedded subdocument |
| `apps/api/src/modules/agency/schemas/brief.schema.ts` | Add `requestAiBonus` + `userId` fields |
| `apps/api/src/modules/agency/services/brief.service.ts` | Grant AI bonus on brief submit |
| `apps/api/src/modules/agency/agency.module.ts` | Add User schema to imports (if not present) |
| `apps/web/src/shared/api/client.ts` | No changes needed — `getAccessToken()` already exported |
| `apps/web/src/shared/api/index.ts` | Export ai module |
| `apps/web/src/app/[locale]/(protected)/dashboard/page.tsx` | Add AiChat section above spend buttons |
| `apps/web/src/stores/briefDialog/briefDialogStore.ts` | Add `requestAiBonus` state |
| `apps/web/src/features/agency/brief/BriefForm.tsx` | Plain text name/email + AI bonus flag + userId |
| `apps/web/messages/en.json` | AI chat + brief-gate translations |
| `apps/web/messages/uk.json` | AI chat + brief-gate translations |
| `.env.example` | AI env vars |

### New Dependencies

| Package | Workspace | Purpose |
|---------|-----------|---------|
| `@anthropic-ai/sdk` | `apps/api` | Anthropic API client |

---

## Tech Debt (out of scope)

- **Turnstile on auth**: CAPTCHA only on brief form, not on registration. Separate sprint: `docs/sprints/auth-turnstile-sprint.md`.

---

## Dependency Order

```
Phase 1 (types)  ─── must be first, everything imports from @cyanship/types
    │
    ├── Phase 6 (env/config) ─── can be parallel with Phase 2
    │
    ├── Phase 2 (backend: AI module) ─── needs types for DTO + cost map
    │       │
    │       └── Phase 3 (backend: brief bonus) ─── modifies existing AgencyModule
    │
    ├── Phase 5 (i18n) ─── can be parallel with Phase 2
    │
    └── Phase 4 (frontend) ─── needs working API endpoints
            │
            └── Phase 7 (testing) ─── after all code
```
