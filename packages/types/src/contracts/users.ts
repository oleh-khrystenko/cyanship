import { z } from 'zod';

import { LANG } from '../constants/lang';

const langValues = Object.values(LANG) as [string, ...string[]];

export const UpdateLangSchema = z.object({
    lang: z.enum(langValues),
});

export const UpdateProfileSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    avatar: z.string().url().optional(),
    preferredLang: z.enum(langValues).optional(),
});

export type UpdateLangDto = z.infer<typeof UpdateLangSchema>;
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
