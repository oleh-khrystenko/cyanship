import { createZodDto } from 'nestjs-zod';
import { VerifyPasswordSchema } from '@lucidship/types';

export class VerifyPasswordDto extends createZodDto(VerifyPasswordSchema) {}
