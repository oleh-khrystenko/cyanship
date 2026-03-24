import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    BRIEF_STATUS,
    BRIEF_BUDGET_LABEL,
    BRIEF_DEADLINE_LABEL,
    type BriefBudget,
    type BriefDeadline,
} from '@cyanship/types';

import { EmailService } from '../../email/email.service';
import { Brief } from '../schemas/brief.schema';
import type { SubmitBriefDto } from '../dto/submit-brief.dto';

@Injectable()
export class BriefService {
    private readonly logger = new Logger(BriefService.name);

    constructor(
        @InjectModel(Brief.name) private readonly briefModel: Model<Brief>,
        private readonly emailService: EmailService,
    ) {}

    async submit(dto: SubmitBriefDto): Promise<void> {
        const brief = await this.briefModel.create({
            name: dto.name,
            email: dto.email,
            description: dto.description,
            budget: dto.budget,
            deadline: dto.deadline ?? null,
            source: dto.source ?? null,
            lang: dto.lang ?? null,
            status: BRIEF_STATUS.NEW,
        });

        this.logger.log(`Brief submitted: ${brief._id} from ${dto.email}`);

        // Fire-and-forget: emails should not block the response
        // but we still log failures
        await Promise.allSettled([
            this.emailService.sendBriefConfirmation({
                email: dto.email,
                name: dto.name,
                lang: dto.lang,
            }),
            this.emailService.sendBriefNotification({
                name: dto.name,
                email: dto.email,
                description: dto.description,
                budget: dto.budget,
                budgetLabel: BRIEF_BUDGET_LABEL[dto.budget as BriefBudget],
                deadline: dto.deadline ?? null,
                deadlineLabel: dto.deadline
                    ? BRIEF_DEADLINE_LABEL[dto.deadline as BriefDeadline]
                    : null,
                source: dto.source ?? null,
            }),
        ]).then((results) => {
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    const target = i === 0 ? 'confirmation' : 'notification';
                    this.logger.error(
                        `Failed to send brief ${target} email: ${r.reason}`,
                    );
                }
            });
        });
    }
}
