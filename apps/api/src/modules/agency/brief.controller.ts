import { Body, Controller, Ip, Post } from '@nestjs/common';
import { RESPONSE_CODE } from '@cyanship/types';

import { SkipOnboarding } from '../../common/decorators/skip-onboarding.decorator';
import { SubmitBriefDto } from './dto/submit-brief.dto';
import { BriefService } from './services/brief.service';
import { TurnstileService } from './services/turnstile.service';

@Controller('agency')
export class BriefController {
    constructor(
        private readonly briefService: BriefService,
        private readonly turnstileService: TurnstileService
    ) {}

    @Post('brief')
    @SkipOnboarding()
    async submitBrief(
        @Body() dto: SubmitBriefDto,
        @Ip() ip: string
    ): Promise<{ data: null; code: string }> {
        await this.turnstileService.verify(dto.captchaToken, ip);
        await this.briefService.submit(dto);

        return {
            data: null,
            code: RESPONSE_CODE.BRIEF_SUBMITTED,
        };
    }
}
