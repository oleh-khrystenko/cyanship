import { z } from 'zod';

import { LANG } from '../constants/lang';

const langValues = Object.values(LANG) as [string, ...string[]];

export const UpdateLangSchema = z.object({
    lang: z.enum(langValues),
});

export type UpdateLangDto = z.infer<typeof UpdateLangSchema>;
