import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    Req,
    Res,
    Post,
    UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
    AI_CHAT_COST,
    AI_CHAT_EVENT,
    RESPONSE_CODE,
    type AiChatDoneEvent,
    type AiChatErrorEvent,
    type AiChatTokenEvent,
    type ChatMessageItem,
} from '@cyanship/types';

import { JwtActiveGuard } from '../../common/guards/jwt-active.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { AiService } from './ai.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';

@Controller('ai')
export class AiController {
    private readonly logger = new Logger(AiController.name);

    constructor(private readonly aiService: AiService) {}

    @Post('chat')
    @UseGuards(JwtActiveGuard, AiRateLimitGuard)
    async chat(
        @CurrentUser() user: UserDocument,
        @Body() dto: AiChatDto,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        const userId = user._id.toString();

        // Pre-stream balance check (throws HTTP error before SSE headers)
        if (user.executions.balance < AI_CHAT_COST) {
            throw new BadRequestException({
                code: RESPONSE_CODE.INSUFFICIENT_EXECUTIONS,
                message: 'Insufficient executions',
            });
        }

        // Set SSE headers — after this point, errors go as SSE events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const abortController = new AbortController();
        let aborted = false;

        const onClose = () => {
            aborted = true;
            abortController.abort();
        };
        req.on('close', onClose);

        try {
            const stream = await this.aiService.processChat(
                dto.message,
                abortController.signal,
            );

            let assistantContent = '';

            for await (const chunk of stream) {
                if (aborted) break;

                assistantContent += chunk as string;
                this.writeSSE<AiChatTokenEvent>(res, {
                    type: AI_CHAT_EVENT.TOKEN,
                    content: chunk as string,
                });
            }

            if (!aborted) {
                const result = await this.aiService.finalizeChat(
                    userId,
                    dto.message,
                    assistantContent,
                );

                this.writeSSE<AiChatDoneEvent>(res, {
                    type: AI_CHAT_EVENT.DONE,
                    balanceAfter: result.balanceAfter,
                    aiRequestsRemaining: result.aiRequestsRemaining,
                });
            }
        } catch (err) {
            if (!aborted) {
                this.logger.error(
                    `AI chat error for user ${userId}: ${(err as Error).message}`,
                );
                this.writeSSE<AiChatErrorEvent>(res, {
                    type: AI_CHAT_EVENT.ERROR,
                    code: 'AI_PROVIDER_ERROR',
                });
            }
        } finally {
            req.off('close', onClose);
            if (!res.writableEnded) {
                res.end();
            }
        }
    }

    @Get('chat/history')
    @UseGuards(JwtActiveGuard)
    async getHistory(
        @CurrentUser() user: UserDocument,
    ): Promise<{ data: { messages: ChatMessageItem[] } }> {
        const messages = await this.aiService.getHistory(user._id.toString());
        return { data: { messages } };
    }

    @Delete('chat/history')
    @UseGuards(JwtActiveGuard)
    @HttpCode(HttpStatus.OK)
    async clearHistory(
        @CurrentUser() user: UserDocument,
    ): Promise<{ data: { cleared: boolean } }> {
        await this.aiService.clearHistory(user._id.toString());
        return { data: { cleared: true } };
    }

    private writeSSE<T>(res: Response, data: T): void {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}
