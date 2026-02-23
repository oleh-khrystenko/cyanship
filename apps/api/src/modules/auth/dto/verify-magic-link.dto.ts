import { createZodDto } from 'nestjs-zod';

import { VerifyMagicLinkSchema } from '@bidguard/types';

export class VerifyMagicLinkDto extends createZodDto(VerifyMagicLinkSchema) {}
