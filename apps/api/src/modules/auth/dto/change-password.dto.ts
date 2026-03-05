import { createZodDto } from 'nestjs-zod';
import { ChangePasswordSchema } from '@lucidship/types';

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
