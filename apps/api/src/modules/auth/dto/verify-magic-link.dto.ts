import { createZodDto } from 'nestjs-zod';

import { VerifyMagicLinkSchema } from '@lucidkit/types';

export class VerifyMagicLinkDto extends createZodDto(VerifyMagicLinkSchema) {}
