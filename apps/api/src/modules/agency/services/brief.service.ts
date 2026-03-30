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
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Brief } from '../schemas/brief.schema';
import type { SubmitBriefDto } from '../dto/submit-brief.dto';

export interface SubmitBriefOptions {
    dto: SubmitBriefDto;
    userId?: string;
    requestAiBonus?: boolean;
}

@Injectable()
export class BriefService {
    private readonly logger = new Logger(BriefService.name);

    constructor(
        @InjectModel(Brief.name) private readonly briefModel: Model<Brief>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        private readonly emailService: EmailService
    ) {}

    async submit(
        options: SubmitBriefOptions
    ): Promise<{ aiBonusGranted: boolean }> {
        const { dto, userId, requestAiBonus } = options;

        const brief = await this.briefModel.create({
            name: dto.name,
            email: dto.email,
            description: dto.description,
            budget: dto.budget,
            deadline: dto.deadline ?? null,
            source: dto.source ?? null,
            lang: dto.lang ?? null,
            status: BRIEF_STATUS.NEW,
            ...(userId && { userId }),
            ...(requestAiBonus && { requestAiBonus: true }),
        });

        this.logger.log(
            `Brief submitted: ${brief._id.toString()} from ${dto.email}`
        );

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
                        `Failed to send brief ${target} email: ${r.reason}`
                    );
                }
            });
        });

        // Grant one-time AI bonus if requested by authenticated user
        let aiBonusGranted = false;

        if (requestAiBonus && userId) {
            const result = await this.userModel.findOneAndUpdate(
                {
                    _id: userId,
                    'ai.bonusGranted': { $ne: true },
                },
                { $set: { 'ai.bonusGranted': true } },
                { new: true }
            );

            aiBonusGranted = result !== null;

            if (aiBonusGranted) {
                this.logger.log(
                    `AI bonus granted to user ${userId} via brief ${brief._id.toString()}`
                );
            }
        }

        return { aiBonusGranted };
    }
}
