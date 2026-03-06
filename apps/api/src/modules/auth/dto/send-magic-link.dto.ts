import { createZodDto } from 'nestjs-zod';

import { SendMagicLinkSchema } from '@lucidship/types';

export class SendMagicLinkDto extends createZodDto(SendMagicLinkSchema) {}
