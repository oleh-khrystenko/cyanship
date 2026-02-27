import { createZodDto } from 'nestjs-zod';
import { SetPasswordSchema } from '@lucidkit/types';

export class SetPasswordDto extends createZodDto(SetPasswordSchema) {}
