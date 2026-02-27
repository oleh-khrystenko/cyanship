import { createZodDto } from 'nestjs-zod';

import { UpdateLangSchema } from '@lucidkit/types';

export class UpdateLangDto extends createZodDto(UpdateLangSchema) {}
