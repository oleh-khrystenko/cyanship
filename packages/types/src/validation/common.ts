import { z } from 'zod';

export const emailSchema = z.string().email();

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
