import { createZodDto } from 'nestjs-zod';
import { ResetPasswordSchema } from '@lucidship/types';

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
