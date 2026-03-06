import { createZodDto } from 'nestjs-zod';
import { CreateCheckoutSessionSchema } from '@lucidship/types';

export class CreateCheckoutSessionDto extends createZodDto(
    CreateCheckoutSessionSchema
) {}
