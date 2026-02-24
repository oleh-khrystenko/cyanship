import { Injectable, Logger } from '@nestjs/common';
import { Lang, LANG } from '@lucidkit/types';
import { Resend } from 'resend';

import { ENV } from '../../../config/env';

const TEMPLATES: Record<
    Lang,
    {
        subject: string;
        body: string;
        cta: string;
        footer: string;
    }
> = {
    [LANG.UK]: {
        subject: 'Вхід у LucidKit',
        body: 'Натисніть кнопку нижче, щоб увійти у ваш акаунт.',
        cta: 'Увійти в LucidKit',
        footer: 'Посилання дійсне 15 хвилин. Якщо ви не запитували вхід — ігноруйте цей лист.',
    },
    [LANG.EN]: {
        subject: 'Sign in to LucidKit',
        body: 'Click the button below to sign in to your account.',
        cta: 'Sign in to LucidKit',
        footer: "This link expires in 15 minutes. If you didn't request this — ignore this email.",
    },
};

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly resend = new Resend(ENV.RESEND_API_KEY);

    async sendMagicLink(
        email: string,
        token: string,
        lang: Lang = LANG.UK
    ): Promise<void> {
        const link = `${ENV.WEB_URL}/auth/verify?token=${token}`;
        const t = TEMPLATES[lang];

        const { error } = await this.resend.emails.send({
            from: ENV.RESEND_FROM_EMAIL,
            to: email,
            subject: t.subject,
            html: `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; background: #f4f4f5; padding: 40px 0;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; text-align: center;">
    <h1 style="font-size: 24px; color: #18181b; margin-bottom: 8px;">LucidKit</h1>
    <p style="color: #52525b; font-size: 16px; margin-bottom: 32px;">
      ${t.body}
    </p>
    <a href="${link}"
       style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
              padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
      ${t.cta}
    </a>
    <p style="color: #a1a1aa; font-size: 13px; margin-top: 32px;">
      ${t.footer}
    </p>
  </div>
</body>
</html>`.trim(),
        });

        if (error) {
            this.logger.error(
                `Failed to send magic link to ${email}: ${error.message}`
            );
            throw new Error(`Failed to send email: ${error.message}`);
        }

        this.logger.log(`Magic link sent to ${email}`);
    }
}
