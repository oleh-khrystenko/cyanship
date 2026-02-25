import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema';

interface GoogleProfile {
    email: string;
    name?: string;
    avatar?: string;
    providerId: string;
}

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>
    ) {}

    async findByEmail(email: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ email: email.toLowerCase() }).exec();
    }

    async findById(id: string): Promise<UserDocument | null> {
        return this.userModel.findById(id).exec();
    }

    async findOrCreateByGoogle(
        googleProfile: GoogleProfile
    ): Promise<UserDocument> {
        const existing = await this.userModel
            .findOne({ email: googleProfile.email.toLowerCase() })
            .exec();

        if (existing) {
            existing.lastLoginAt = new Date();

            if (!existing.provider) {
                existing.provider = {
                    name: 'google',
                    id: googleProfile.providerId,
                };
            }

            if (googleProfile.name && !existing.profile.name) {
                existing.profile.name = googleProfile.name;
            }

            if (googleProfile.avatar && !existing.profile.avatar) {
                existing.profile.avatar = googleProfile.avatar;
            }

            return existing.save();
        }

        return this.userModel.create({
            email: googleProfile.email.toLowerCase(),
            provider: { name: 'google', id: googleProfile.providerId },
            profile: {
                name: googleProfile.name,
                avatar: googleProfile.avatar,
            },
            lastLoginAt: new Date(),
        });
    }

    async findOrCreateByEmail(email: string): Promise<UserDocument> {
        const normalizedEmail = email.toLowerCase();
        const existing = await this.userModel
            .findOne({ email: normalizedEmail })
            .exec();

        if (existing) {
            existing.lastLoginAt = new Date();
            return existing.save();
        }

        return this.userModel.create({
            email: normalizedEmail,
            lastLoginAt: new Date(),
        });
    }

    async deductCredit(userId: string): Promise<boolean> {
        const user = await this.userModel.findById(userId).exec();
        if (!user) return false;

        if (user.credits.balance > 0) {
            user.credits.balance -= 1;
            await user.save();
            return true;
        }

        if (!user.credits.freeReportUsed) {
            user.credits.freeReportUsed = true;
            await user.save();
            return true;
        }

        return false;
    }

    async updateLang(userId: string, lang: string): Promise<void> {
        await this.userModel
            .findByIdAndUpdate(userId, { preferredLang: lang })
            .exec();
    }

    async setPasswordHash(userId: string, hash: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, { passwordHash: hash });
    }

    async clearPasswordHash(userId: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, { passwordHash: null });
    }

    async hasCredit(userId: string): Promise<boolean> {
        const user = await this.userModel.findById(userId).exec();
        if (!user) return false;

        return user.credits.balance > 0 || !user.credits.freeReportUsed;
    }
}
