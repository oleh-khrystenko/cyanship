import { z } from 'zod';

import { LANG } from '../constants/lang';
import { UserProfileSchema } from '../entities/user';

const langValues = Object.values(LANG) as [string, ...string[]];

export const SendMagicLinkSchema = z.object({
    email: z.string().email(),
    lang: z.enum(langValues).optional(),
});

export const VerifyMagicLinkSchema = z.object({
    token: z.string().min(1),
});

export const AuthResponseSchema = z.object({
    user: UserProfileSchema,
    accessToken: z.string(),
});

export type SendMagicLinkDto = z.infer<typeof SendMagicLinkSchema>;
export type VerifyMagicLinkDto = z.infer<typeof VerifyMagicLinkSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
