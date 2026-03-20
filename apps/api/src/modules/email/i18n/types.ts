import type { MagicLinkPurpose } from '@cyanship/types';

export interface MagicLinkTranslations {
    subject: string;
    body: string;
    cta: string;
    footer: string;
}

export interface DeletionConfirmationTranslations {
    subject: string;
    body: (formattedDate: string) => string;
    instruction: string;
    cta: string;
    footer: string;
}

export interface EmailTranslations {
    magicLink: Record<MagicLinkPurpose, MagicLinkTranslations>;
    deletionConfirmation: DeletionConfirmationTranslations;
}
