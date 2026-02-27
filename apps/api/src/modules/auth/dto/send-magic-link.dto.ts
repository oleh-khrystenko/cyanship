import { createZodDto } from 'nestjs-zod';

import { SendMagicLinkSchema } from '@lucidkit/types';

export class SendMagicLinkDto extends createZodDto(SendMagicLinkSchema) {}
