import { createZodDto } from 'nestjs-zod';
import { UpdateProfileSchema } from '@lucidkit/types';

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
