import { createZodDto } from 'nestjs-zod';
import { LoginPasswordSchema } from '@lucidkit/types';

export class LoginPasswordDto extends createZodDto(LoginPasswordSchema) {}
