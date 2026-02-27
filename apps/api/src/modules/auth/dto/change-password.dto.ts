import { createZodDto } from 'nestjs-zod';
import { ChangePasswordSchema } from '@lucidkit/types';

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
