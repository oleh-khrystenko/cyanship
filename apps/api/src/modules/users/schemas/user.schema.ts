import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { LANG } from '@lucidkit/types';
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

    @Prop({ required: true, default: LANG.UK })
    preferredLang!: string;

    @Prop()
    lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ 'provider.id': 1 }, { sparse: true });
