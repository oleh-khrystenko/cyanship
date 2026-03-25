import { z } from 'zod';

/** Unicode letters, spaces, apostrophes, hyphens. Min 2, max 100 chars. */
export const nameSchema = z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[\p{L}\s'\-]+$/u);

export const emailSchema = z.string().email();

export const passwordSchema = z.string().min(8);

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
