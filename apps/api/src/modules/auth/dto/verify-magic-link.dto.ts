import { createZodDto } from 'nestjs-zod';

import { VerifyMagicLinkSchema } from '@lucidship/types';

export class VerifyMagicLinkDto extends createZodDto(VerifyMagicLinkSchema) {}
