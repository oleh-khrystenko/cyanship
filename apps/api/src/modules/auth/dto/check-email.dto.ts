import { createZodDto } from 'nestjs-zod';
import { CheckEmailSchema } from '@lucidkit/types';

export class CheckEmailDto extends createZodDto(CheckEmailSchema) {}
