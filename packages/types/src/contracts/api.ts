import { z } from 'zod';

import { ERROR_CODE } from '../enums/error-code';

export const ApiErrorSchema = z.object({
    code: z.nativeEnum(ERROR_CODE),
    message: z.string(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export interface ApiResponse<T> {
    data: T;
    meta?: Record<string, unknown>;
}
