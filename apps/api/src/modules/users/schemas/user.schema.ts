import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { LANG } from '@lucidship/types';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
class UserProvider {
    @Prop({ required: true })
    name!: string;

    @Prop({ required: true })
    id!: string;
}

@Schema({ _id: false })
class UserProfileData {
    @Prop()
    name?: string;

    @Prop()
    avatar?: string;
}

@Schema({ _id: false })
class UserCredits {
    @Prop({ required: true, default: 0, min: 0 })
    balance!: number;

    @Prop({ required: true, default: false })
    freeReportUsed!: boolean;
}

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    email!: string;

    @Prop({ type: UserProvider })
    provider?: UserProvider;

    @Prop({ type: UserProfileData, default: () => ({}) })
    profile!: UserProfileData;

    @Prop({
        type: UserCredits,
        default: () => ({ balance: 0, freeReportUsed: false }),
    })
    credits!: UserCredits;

    @Prop({ type: String, default: null })
    passwordHash!: string | null;

    @Prop({ type: Date, default: null })
    deletedAt!: Date | null;

    @Prop({ type: Date, default: null })
    accountDeletionRequestedAt!: Date | null;

    @Prop({ required: true, default: LANG.EN })
    preferredLang!: string;

    @Prop()
    lastLoginAt?: Date;

    @Prop({
        type: {
            provider: { type: String, default: null },
            providerCustomerId: { type: String, default: null },
            providerSubscriptionId: { type: String, default: null },
            planCode: { type: String, default: null },
            currency: { type: String, default: null },
            subscriptionStatus: { type: String, default: null },
            providerSubscriptionStatus: { type: String, default: null },
            currentPeriodEnd: { type: Date, default: null },
            cancelAtPeriodEnd: { type: Boolean, default: false },
            hasActiveSubscription: { type: Boolean, default: false },
            lastProviderEventAt: { type: Date, default: null },
        },
        default: null,
        _id: false,
    })
    billing!: {
        provider: string | null;
        providerCustomerId: string | null;
        providerSubscriptionId: string | null;
        planCode: string | null;
        currency: string | null;
        subscriptionStatus: string | null;
        providerSubscriptionStatus: string | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
        hasActiveSubscription: boolean;
        lastProviderEventAt: Date | null;
    } | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ 'provider.id': 1 }, { sparse: true });
UserSchema.index({ 'billing.providerCustomerId': 1 }, { sparse: true });
UserSchema.index({ 'billing.providerSubscriptionId': 1 }, { sparse: true });
