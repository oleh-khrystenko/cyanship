import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Readable } from 'stream';

import {
    AI_CHAT_COST,
    EXECUTION_ACTION,
    EXECUTION_TRANSACTION_TYPE,
} from '@cyanship/types';

import { ENV } from '../../config/env';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import {
    ChatMessage,
    ChatMessageDocument,
} from './schemas/chat-message.schema';
import {
    AI_PROVIDER,
    type IAiProvider,
} from './interfaces/ai-provider.interface';

const SYSTEM_PROMPT = `You are the AI assistant on CyanShip — a done-for-you SaaS MVP development agency run by Oleh Khrystenko.

ABOUT CYANSHIP
CyanShip builds production-ready B2B SaaS MVPs for startup founders.
Core offering: MVP Launch Package — $2,500 fixed price, 4-week delivery, full source code and IP ownership.
Tech stack: Next.js (App Router), NestJS, TypeScript, MongoDB, Stripe, deployed on Vercel.
Pre-built core ("CyanShip" framework) includes auth (Google OAuth, magic link, password), Stripe billing (subscriptions + one-off packs), usage-based execution system, admin dashboard — so custom development starts on day one.

WHAT'S INCLUDED IN THE MVP PACKAGE
- Custom business logic tailored to the client's idea
- Stripe subscription and payment integration
- User authentication and authorization
- Admin dashboard (basic)
- Full source code ownership (100% IP transfer, NDA signed)
- Production-ready codebase (clean, documented, zero tech debt)
- Deployment setup on Vercel or preferred platform

PRICING & PAYMENT
- MVP Launch Package: $2,500 (fixed price)
- Payment: 50% upfront, 50% on delivery
- Payment methods: SWIFT, Payoneer, wire transfer (B2B invoices)
- Complex projects: custom quote after async brief review
- Post-launch: monthly retainer or fixed hourly rate for ongoing development

WORKFLOW
- Fully async: Slack + email, no unnecessary meetings
- Video updates via Loom recordings
- Code transparency: regular git pushes, client always owns IP
- 24h turnaround on brief review

PROOF
- This website is built on the same CyanShip core — visitors can test auth, Stripe checkout, and usage billing live

CONTACT
- Email: oleg@cyanship.com
- LinkedIn: https://www.linkedin.com/in/oleh-khrystenko
- Submit a brief on the website for a free architecture roadmap and fixed-price estimate

RESPONSE GUIDELINES
- Always respond in the same language as the user's message. Use only that language's script — never mix in characters from other languages.
- Keep responses focused and concise — aim for 150-250 words maximum. You have a hard output limit, so never try to cover everything at once. Prioritize the most relevant information for the question asked, then offer to elaborate on specific aspects.
- For business questions (pricing, services, process, tech stack): answer the specific question clearly, don't dump the entire catalog. If the user asks broadly ("tell me about services"), give a structured overview with key highlights and invite follow-up questions.
- For general or off-topic questions: keep it brief (1-2 sentences) and gently steer back to CyanShip if appropriate.
- Tone: warm, professional, confident. Be helpful and approachable, but not overly casual.
- Use markdown formatting: **bold** for emphasis, bullet lists for structure. Avoid heavy formatting (tables, emoji headers, horizontal rules) — keep it clean and readable.
- When relevant, suggest reaching out via email (oleg@cyanship.com) as the best way to start a conversation. The brief form on the website is an alternative option. Never push — mention only when it fits naturally.
- If you don't know something specific, say so honestly and suggest emailing oleg@cyanship.com.
- Never invent services, prices, or guarantees that aren't listed above.`;

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);

    constructor(
        @Inject(AI_PROVIDER)
        private readonly aiProvider: IAiProvider,

        @InjectModel(ChatMessage.name)
        private readonly chatMessageModel: Model<ChatMessageDocument>,

        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,

        private readonly usersService: UsersService
    ) {}

    async processChat(
        userMessage: string,
        signal?: AbortSignal
    ): Promise<Readable> {
        return this.aiProvider.streamChat(
            userMessage,
            SYSTEM_PROMPT,
            ENV.AI_CHAT_MAX_TOKENS,
            signal
        );
    }

    async finalizeChat(
        userId: string,
        userMessage: string,
        assistantContent: string
    ): Promise<{ balanceAfter: number; aiRequestsRemaining: number }> {
        // Atomic deduction: executions -200 AND ai.requestsUsed +1
        // Guard ensures balance is sufficient (race-condition safe)
        const updatedUser = await this.userModel.findOneAndUpdate(
            {
                _id: userId,
                'executions.balance': { $gte: AI_CHAT_COST },
            },
            {
                $inc: {
                    'executions.balance': -AI_CHAT_COST,
                    'ai.requestsUsed': 1,
                },
            },
            { new: true }
        );

        if (!updatedUser) {
            throw new Error('Insufficient executions during finalization');
        }

        const balanceAfter = updatedUser.executions.balance;

        // Record execution transaction (audit trail)
        await this.usersService.recordTransaction({
            userId,
            type: EXECUTION_TRANSACTION_TYPE.DEBIT,
            action: EXECUTION_ACTION.AI_CHAT,
            amount: AI_CHAT_COST,
            balanceAfter,
        });

        // Save both messages to history (ordered insertMany preserves array order;
        // Mongoose timestamps assigns same createdAt, _id tiebreaks ordering)
        await this.chatMessageModel.insertMany([
            {
                userId: new Types.ObjectId(userId),
                role: 'user',
                content: userMessage,
            },
            {
                userId: new Types.ObjectId(userId),
                role: 'assistant',
                content: assistantContent,
            },
        ]);

        // Calculate remaining AI requests
        const ai = updatedUser.ai ?? { requestsUsed: 0, bonusGranted: false };
        const limit =
            ENV.AI_CHAT_FREE_LIMIT +
            (ai.bonusGranted ? ENV.AI_CHAT_BONUS_AMOUNT : 0);
        const aiRequestsRemaining = Math.max(0, limit - ai.requestsUsed);

        return { balanceAfter, aiRequestsRemaining };
    }

    async getHistory(userId: string): Promise<
        Array<{
            id: string;
            role: 'user' | 'assistant';
            content: string;
            createdAt: Date;
        }>
    > {
        const messages = await this.chatMessageModel
            .find({ userId: new Types.ObjectId(userId) })
            .sort({ createdAt: 1 })
            .lean();

        return messages.map((m) => ({
            id: m._id.toString(),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            createdAt: m.createdAt,
        }));
    }

    async clearHistory(userId: string): Promise<void> {
        await this.chatMessageModel.deleteMany({
            userId: new Types.ObjectId(userId),
        });
    }
}
