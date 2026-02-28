import {
    BadRequestException,
    Body,
    Controller,
    Headers,
    Param,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RawBodyRequest } from '@nestjs/common/interfaces';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { PaymentsService } from './payments.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @UseGuards(JwtAuthGuard)
    @Post('checkout-session')
    async createCheckoutSession(
        @CurrentUser() user: UserDocument,
        @Body() dto: CreateCheckoutSessionDto,
    ): Promise<{ data: { checkoutUrl: string } }> {
        const result = await this.paymentsService.createCheckoutSession(
            user._id.toString(),
            dto.planCode,
        );
        return { data: { checkoutUrl: result.checkoutUrl } };
    }

    @UseGuards(JwtAuthGuard)
    @Post('portal-session')
    async createPortalSession(
        @CurrentUser() user: UserDocument,
    ): Promise<{ data: { portalUrl: string } }> {
        const result = await this.paymentsService.createPortalSession(
            user._id.toString(),
        );
        return { data: { portalUrl: result.portalUrl } };
    }

    @SkipThrottle()
    @Post('webhook/:provider')
    async handleWebhook(
        @Param('provider') provider: string,
        @Req() req: RawBodyRequest<Request>,
        @Headers('stripe-signature') signature: string,
    ): Promise<{ received: true }> {
        const rawBody = req.rawBody;
        if (!rawBody) {
            throw new BadRequestException('Missing raw body');
        }
        await this.paymentsService.handleWebhook(
            provider,
            rawBody,
            signature,
        );
        return { received: true };
    }
}
