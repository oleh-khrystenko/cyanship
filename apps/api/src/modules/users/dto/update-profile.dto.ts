import { createZodDto } from 'nestjs-zod';
import { UpdateProfileSchema } from '@lucidship/types';

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
