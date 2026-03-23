import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';

import { ENV } from '../../config/env';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class CleanupService {
    private readonly logger = new Logger(CleanupService.name);

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private readonly authService: AuthService,
        private readonly emailService: EmailService
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async handleExpiredAccounts(): Promise<void> {
        await this.sendDeletionReminders();
        await this.hardDeleteExpiredAccounts();
    }

    private async sendDeletionReminders(): Promise<void> {
        const graceDays = ENV.ACCOUNT_DELETION_GRACE_DAYS;

        if (graceDays < 2) return;

        const reminderCutoff = new Date(
            Date.now() - (graceDays - 1) * 86_400_000
        );
        const hardDeleteCutoff = new Date(Date.now() - graceDays * 86_400_000);

        const usersToRemind = await this.userModel
            .find({
                deletedAt: { $lte: reminderCutoff, $gt: hardDeleteCutoff },
                deletionReminderSentAt: null,
            })
            .select('_id email preferredLang deletedAt')
            .lean()
            .exec();

        if (usersToRemind.length === 0) return;

        let sent = 0;

        for (const user of usersToRemind) {
            const userId = user._id.toString();
            try {
                const deletionDate = new Date(
                    user.deletedAt!.getTime() + graceDays * 86_400_000
                );

                await this.emailService.sendDeletionReminder({
                    email: user.email,
                    deletionDate,
                    lang: user.preferredLang,
                });

                await this.userModel.findByIdAndUpdate(userId, {
                    deletionReminderSentAt: new Date(),
                });

                sent++;
            } catch (error) {
                this.logger.error(
                    `Failed to send deletion reminder to ${userId}: ${(error as Error).message}`
                );
            }
        }

        this.logger.log(
            `Sent ${sent}/${usersToRemind.length} deletion reminder(s)`
        );
    }

    private async hardDeleteExpiredAccounts(): Promise<void> {
        const cutoff = new Date(
            Date.now() - ENV.ACCOUNT_DELETION_GRACE_DAYS * 86_400_000
        );

        const expiredUsers = await this.userModel
            .find({ deletedAt: { $lte: cutoff } })
            .select('_id email')
            .lean()
            .exec();

        if (expiredUsers.length === 0) {
            this.logger.log('No expired accounts to delete');
            return;
        }

        let deleted = 0;

        for (const user of expiredUsers) {
            const userId = user._id.toString();
            try {
                await this.authService.revokeAllUserTokens(userId);
                await this.userModel.findByIdAndDelete(userId).exec();
                deleted++;
            } catch (error) {
                this.logger.error(
                    `Failed to hard-delete user ${userId}: ${(error as Error).message}`
                );
            }
        }

        this.logger.log(
            `Hard-deleted ${deleted}/${expiredUsers.length} expired account(s)`
        );
    }
}
