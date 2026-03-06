import { createZodDto } from 'nestjs-zod';
import { CheckEmailSchema } from '@lucidship/types';

export class CheckEmailDto extends createZodDto(CheckEmailSchema) {}
