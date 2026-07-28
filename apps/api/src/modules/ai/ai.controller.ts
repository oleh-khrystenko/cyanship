import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    Res,
    Post,
    UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
    AI_CHAT_EVENT,
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
        @Res() res: Response
    ): Promise<void> {
        const userId = user._id.toString();

        // Pre-stream phase: any 4xx exception propagates as HTTP error — SSE headers not yet set.
        const reservation = await this.aiService.reserveChatRequest(userId);

        const abortController = new AbortController();
        let aborted = false;

        // Client disconnect must be observed on the RESPONSE, not the request:
        // `req` emits 'close' as soon as its body has been read (which already
        // happened in the body parser before this handler runs), so a listener
        // attached here would either never fire or fire immediately. `res`
        // emits 'close' both on a premature disconnect and after a normal
        // `res.end()` — `writableEnded` separates the two.
        const onClose = () => {
            if (res.writableEnded) return;
            aborted = true;
            abortController.abort();
        };
        res.on('close', onClose);

        let messages;
        try {
            messages = await this.aiService.buildChatMessages(
                userId,
                dto.message
            );
        } catch (err) {
            res.off('close', onClose);
            await this.aiService.refundChatRequest(reservation);
            throw err;
        }

        if (aborted) {
            res.off('close', onClose);
            await this.aiService.refundChatRequest(reservation);
            return;
        }

        // SSE bootstrap — after this point, errors go as SSE events.
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.socket?.setNoDelay(true);
        res.flushHeaders();

        let firstTokenReceived = false;
        let committed = false;
        let assistantContent = '';

        try {
            const stream = await this.aiService.streamChat(
                messages,
                abortController.signal
            );

            for await (const chunk of stream) {
                if (aborted) break;

                if (!firstTokenReceived) {
                    firstTokenReceived = true;
                }

                assistantContent += chunk as string;
                this.writeSSE<AiChatTokenEvent>(res, {
                    type: AI_CHAT_EVENT.TOKEN,
                    content: chunk as string,
                });
            }

            if (!aborted) {
                // Happy path — commit and send DONE.
                const result = await this.aiService.commitChatRequest(
                    reservation,
                    dto.message,
                    assistantContent
                );
                committed = true;

                this.writeSSE<AiChatDoneEvent>(res, {
                    type: AI_CHAT_EVENT.DONE,
                    balanceAfter: result.balanceAfter,
                    aiRequestsRemaining: result.aiRequestsRemaining,
                });
            } else if (firstTokenReceived) {
                // Client aborted after first token — non-refundable, commit silently.
                try {
                    await this.aiService.commitChatRequest(
                        reservation,
                        dto.message,
                        assistantContent
                    );
                    committed = true;
                } catch (commitErr) {
                    this.logger.error(
                        `Commit after abort failed for reservation ${reservation.reservationId}: ${(commitErr as Error).message}`
                    );
                }
            }
            // aborted && !firstTokenReceived → do nothing, refund in finally
        } catch (err) {
            this.logger.error(
                `AI chat error for user ${userId}, reservation ${reservation.reservationId}: ${(err as Error).message}`
            );

            // Abort signal may cause provider to throw after first token — still non-refundable.
            if (aborted && firstTokenReceived && !committed) {
                try {
                    await this.aiService.commitChatRequest(
                        reservation,
                        dto.message,
                        assistantContent
                    );
                    committed = true;
                } catch {
                    // Commit failed — will refund in finally.
                }
            }

            if (!aborted) {
                this.writeSSE<AiChatErrorEvent>(res, {
                    type: AI_CHAT_EVENT.ERROR,
                    code: 'AI_PROVIDER_ERROR',
                });
            }
        } finally {
            res.off('close', onClose);

            if (!committed) {
                await this.aiService.refundChatRequest(reservation);
            }

            if (!res.writableEnded) {
                res.end();
            }
        }
    }

    @Get('chat/history')
    @UseGuards(JwtActiveGuard)
    async getHistory(
        @CurrentUser() user: UserDocument
    ): Promise<{ data: { messages: ChatMessageItem[] } }> {
        const messages = await this.aiService.getHistory(user._id.toString());
        return { data: { messages } };
    }

    @Delete('chat/history')
    @UseGuards(JwtActiveGuard)
    @HttpCode(HttpStatus.OK)
    async clearHistory(
        @CurrentUser() user: UserDocument
    ): Promise<{ data: { cleared: boolean } }> {
        await this.aiService.clearHistory(user._id.toString());
        return { data: { cleared: true } };
    }

    private writeSSE<T>(res: Response, data: T): void {
        // Writing to a socket the client already dropped throws
        // ERR_STREAM_DESTROYED; the disconnect is handled by the abort path.
        if (res.writableEnded || res.destroyed) return;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}
