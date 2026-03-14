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

    async addCredits(userId: string, amount: number): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            $inc: { 'credits.balance': amount },
        });
    }

    async deductCredit(userId: string): Promise<boolean> {
        // Try atomic paid-credit deduction first (no race condition).
        const paid = await this.userModel.findOneAndUpdate(
            { _id: userId, 'credits.balance': { $gt: 0 } },
            { $inc: { 'credits.balance': -1 } },
            { new: true }
        );
        if (paid) return true;

        // Fallback: consume free report atomically.
        const free = await this.userModel.findOneAndUpdate(
            { _id: userId, 'credits.freeReportUsed': false },
            { $set: { 'credits.freeReportUsed': true } },
            { new: true }
        );
        return free !== null;
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

    async setDeletionRequested(userId: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            accountDeletionRequestedAt: new Date(),
        });
    }

    async softDelete(userId: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            deletedAt: new Date(),
            accountDeletionRequestedAt: null,
        });
    }

    async restore(userId: string): Promise<void> {
        await this.userModel.findByIdAndUpdate(userId, {
            deletedAt: null,
            accountDeletionRequestedAt: null,
        });
    }

    async updateProfile(
        userId: string,
        data: { name?: string; avatar?: string; preferredLang?: string }
    ): Promise<UserDocument | null> {
        const update: Record<string, unknown> = {};
        if (data.name !== undefined) update['profile.name'] = data.name;
        if (data.avatar !== undefined) update['profile.avatar'] = data.avatar;
        if (data.preferredLang !== undefined)
            update.preferredLang = data.preferredLang;
        return this.userModel.findByIdAndUpdate(userId, update, { new: true });
    }

    async acceptTerms(userId: string, termsVersion: string): Promise<void> {
        await this.userModel.updateOne(
            { _id: userId },
            {
                $set: {
                    termsAcceptedAt: new Date(),
                    termsVersion,
                },
            },
        );
    }

    async hasCredit(userId: string): Promise<boolean> {
        const user = await this.userModel.findById(userId).exec();
        if (!user) return false;

        return user.credits.balance > 0 || !user.credits.freeReportUsed;
    }
}
