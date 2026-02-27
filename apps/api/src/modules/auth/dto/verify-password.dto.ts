import { createZodDto } from 'nestjs-zod';
import { VerifyPasswordSchema } from '@lucidkit/types';

export class VerifyPasswordDto extends createZodDto(VerifyPasswordSchema) {}
