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
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { AI_PROVIDER, type IAiProvider } from './interfaces/ai-provider.interface';

const SYSTEM_PROMPT =
    'You are a helpful AI assistant integrated into CyanShip platform. ' +
    'Keep responses concise: 2-3 sentences maximum. ' +
    'Answer in the same language as the user\'s message.';

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

        private readonly usersService: UsersService,
    ) {}

    async processChat(
        userMessage: string,
        signal?: AbortSignal,
    ): Promise<Readable> {
        return this.aiProvider.streamChat(
            userMessage,
            SYSTEM_PROMPT,
            ENV.AI_CHAT_MAX_TOKENS,
            signal,
        );
    }

    async finalizeChat(
        userId: string,
        userMessage: string,
        assistantContent: string,
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
            { new: true },
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

    async getHistory(
        userId: string,
    ): Promise<
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
