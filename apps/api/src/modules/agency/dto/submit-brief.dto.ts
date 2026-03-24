import { createZodDto } from 'nestjs-zod';
import { SubmitBriefSchema } from '@cyanship/types/agency';

export class SubmitBriefDto extends createZodDto(SubmitBriefSchema) {}
