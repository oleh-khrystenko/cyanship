import { createZodDto } from 'nestjs-zod';

import { SendMagicLinkSchema } from '@bidguard/types';

export class SendMagicLinkDto extends createZodDto(SendMagicLinkSchema) {}
