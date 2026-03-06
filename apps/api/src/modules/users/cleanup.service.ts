import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';

import { ENV } from '../../config/env';
import { AuthService } from '../auth/auth.service';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class CleanupService {
    private readonly logger = new Logger(CleanupService.name);

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private readonly authService: AuthService
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async handleExpiredAccounts(): Promise<void> {
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
