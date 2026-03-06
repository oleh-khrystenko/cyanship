import { createZodDto } from 'nestjs-zod';
import { SetPasswordSchema } from '@lucidship/types';

export class SetPasswordDto extends createZodDto(SetPasswordSchema) {}
