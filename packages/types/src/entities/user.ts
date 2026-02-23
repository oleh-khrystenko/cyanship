import { z } from 'zod';

import { LANG } from '../constants/lang';

export const UserProviderSchema = z.object({
    name: z.string(),
    id: z.string(),
});

export const UserProfileDataSchema = z.object({
    name: z.string().optional(),
    avatar: z.string().url().optional(),
});

export const UserCreditsSchema = z.object({
    balance: z.number().int().min(0),
    freeReportUsed: z.boolean(),
});

export const UserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    provider: UserProviderSchema.optional(),
    profile: UserProfileDataSchema,
    credits: UserCreditsSchema,
    preferredLang: z.enum([LANG.UK, LANG.EN]),
    createdAt: z.coerce.date(),
    lastLoginAt: z.coerce.date().optional(),
});

export const UserProfileSchema = UserSchema.pick({
    id: true,
    email: true,
    profile: true,
    credits: true,
    preferredLang: true,
});

export type User = z.infer<typeof UserSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
