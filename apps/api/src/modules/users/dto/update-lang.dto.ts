import { createZodDto } from 'nestjs-zod';

import { UpdateLangSchema } from '@lucidship/types';

export class UpdateLangDto extends createZodDto(UpdateLangSchema) {}
