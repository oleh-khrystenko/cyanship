import { createZodDto } from 'nestjs-zod';
import { CreateCheckoutSessionSchema } from '@lucidkit/types';

export class CreateCheckoutSessionDto extends createZodDto(
    CreateCheckoutSessionSchema
) {}
