import { Injectable, Logger } from '@nestjs/common';
import {
    LANG,
    MAGIC_LINK_PURPOSE,
    type MagicLinkPurpose,
} from '@cyanship/types';
import { Resend } from 'resend';

import { ENV } from '../../config/env';
import { resolveTranslations } from './i18n/resolve';
import { MagicLinkEmail } from './templates/magic-link';
import { DeletionConfirmationEmail } from './templates/deletion-confirmation';

const DATE_LOCALE: Record<string, string> = {
    [LANG.UK]: 'uk-UA',
    [LANG.EN]: 'en-US',
};

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly resend = new Resend(ENV.RESEND_API_KEY);

    async sendMagicLink(params: {
        email: string;
        token: string;
        purpose: MagicLinkPurpose;
        lang: string;
        redirectTo?: string;
    }): Promise<void> {
        const { email, token, purpose, lang, redirectTo } = params;
        const t = resolveTranslations(lang);
        const link = this.buildMagicLink(token, purpose, redirectTo);

        await this.send({
            to: email,
            subject: t.magicLink[purpose].subject,
            react: MagicLinkEmail({
                link,
                translations: t.magicLink[purpose],
                lang,
            }),
        });

        this.logger.log(`Magic link (${purpose}) sent to ${email}`);
    }

    async sendDeletionConfirmation(params: {
        email: string;
        deletionDate: Date;
        lang: string;
    }): Promise<void> {
        const { email, deletionDate, lang } = params;
        const t = resolveTranslations(lang);

        const formattedDate = deletionDate.toLocaleDateString(
            DATE_LOCALE[lang] ?? DATE_LOCALE[LANG.EN],
            { year: 'numeric', month: 'long', day: 'numeric' }
        );

        await this.send({
            to: email,
            subject: t.deletionConfirmation.subject,
            react: DeletionConfirmationEmail({
                signInUrl: `${ENV.WEB_URL}/auth/signin`,
                translations: t.deletionConfirmation,
                formattedDate,
                lang,
            }),
        });

        this.logger.log(`Deletion confirmation sent to ${email}`);
    }

    private async send(options: {
        to: string;
        subject: string;
        react: React.JSX.Element;
    }): Promise<void> {
        const { error } = await this.resend.emails.send({
            from: ENV.RESEND_FROM_EMAIL,
            ...options,
        });

        if (error) {
            this.logger.error(
                `Failed to send email to ${options.to}: ${error.message}`
            );
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    private buildMagicLink(
        token: string,
        purpose: MagicLinkPurpose,
        redirectTo?: string
    ): string {
        let link =
            purpose === MAGIC_LINK_PURPOSE.RESET_PASSWORD
                ? `${ENV.WEB_URL}/auth/reset-password?token=${token}`
                : `${ENV.WEB_URL}/auth/verify?token=${token}`;

        if (redirectTo && purpose !== MAGIC_LINK_PURPOSE.RESET_PASSWORD) {
            link += `&redirect=${encodeURIComponent(redirectTo)}`;
        }

        return link;
    }
}
