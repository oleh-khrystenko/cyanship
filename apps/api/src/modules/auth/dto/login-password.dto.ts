import { createZodDto } from 'nestjs-zod';
import { LoginPasswordSchema } from '@lucidship/types';

export class LoginPasswordDto extends createZodDto(LoginPasswordSchema) {}
