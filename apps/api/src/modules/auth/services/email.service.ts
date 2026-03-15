import { Injectable, Logger } from '@nestjs/common';
import {
    LANG,
    MAGIC_LINK_PURPOSE,
    type MagicLinkPurpose,
} from '@lucidship/types';
import { Resend } from 'resend';

import { ENV } from '../../../config/env';

interface EmailTemplate {
    subject: string;
    body: string;
    cta: string;
    footer: string;
}

const TEMPLATES: Record<MagicLinkPurpose, Record<string, EmailTemplate>> = {
    [MAGIC_LINK_PURPOSE.LOGIN]: {
        [LANG.UK]: {
            subject: 'Вхід до LucidShip',
            body: 'Натисніть кнопку нижче, щоб увійти у ваш акаунт.',
            cta: 'Увійти',
            footer: 'Посилання дійсне 15 хвилин. Якщо ви не запитували вхід — ігноруйте цей лист.',
        },
        [LANG.EN]: {
            subject: 'Sign in to LucidShip',
            body: 'Click the button below to sign in to your account.',
            cta: 'Sign In',
            footer: "This link expires in 15 minutes. If you didn't request this — ignore this email.",
        },
    },
    [MAGIC_LINK_PURPOSE.REGISTER]: {
        [LANG.UK]: {
            subject: 'Ласкаво просимо до LucidShip',
            body: 'Натисніть кнопку нижче, щоб завершити реєстрацію.',
            cta: 'Завершити реєстрацію',
            footer: 'Посилання дійсне 15 хвилин. Якщо ви не реєструвалися — ігноруйте цей лист.',
        },
        [LANG.EN]: {
            subject: 'Welcome to LucidShip',
            body: 'Click the button below to complete your registration.',
            cta: 'Complete Registration',
            footer: "This link expires in 15 minutes. If you didn't sign up — ignore this email.",
        },
    },
    [MAGIC_LINK_PURPOSE.RESET_PASSWORD]: {
        [LANG.UK]: {
            subject: 'Скидання пароля',
            body: 'Натисніть кнопку нижче, щоб скинути пароль.',
            cta: 'Скинути пароль',
            footer: 'Посилання дійсне 15 хвилин. Якщо ви не запитували скидання — ігноруйте цей лист.',
        },
        [LANG.EN]: {
            subject: 'Reset Your Password',
            body: 'Click the button below to reset your password.',
            cta: 'Reset Password',
            footer: "This link expires in 15 minutes. If you didn't request a reset — ignore this email.",
        },
    },
    [MAGIC_LINK_PURPOSE.DELETE_ACCOUNT]: {
        [LANG.UK]: {
            subject: 'Підтвердження видалення акаунту',
            body: 'Натисніть кнопку нижче, щоб підтвердити видалення акаунту. Після підтвердження у вас буде 30 днів, щоб відновити акаунт — просто увійдіть у свій акаунт протягом цього часу.',
            cta: 'Підтвердити видалення',
            footer: 'Посилання дійсне 15 хвилин. Якщо ви не запитували видалення — ігноруйте цей лист.',
        },
        [LANG.EN]: {
            subject: 'Confirm Account Deletion',
            body: 'Click the button below to confirm account deletion. After confirmation, you will have 30 days to recover your account — just sign in during that time.',
            cta: 'Confirm Deletion',
            footer: "This link expires in 15 minutes. If you didn't request deletion — ignore this email.",
        },
    },
};

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly resend = new Resend(ENV.RESEND_API_KEY);

    async sendMagicLink(
        email: string,
        token: string,
        purpose: MagicLinkPurpose = MAGIC_LINK_PURPOSE.LOGIN,
        lang: string = LANG.EN
    ): Promise<void> {
        const link =
            purpose === MAGIC_LINK_PURPOSE.RESET_PASSWORD
                ? `${ENV.WEB_URL}/auth/reset-password?token=${token}`
                : `${ENV.WEB_URL}/auth/verify?token=${token}`;
        const t = TEMPLATES[purpose][lang] ?? TEMPLATES[purpose][LANG.EN];

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
    <h1 style="font-size: 24px; color: #18181b; margin-bottom: 8px;">LucidShip</h1>
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

        this.logger.log(`Magic link (${purpose}) sent to ${email}`);
    }

    async sendDeletionConfirmation(
        email: string,
        deletionDate: Date,
        lang: string = LANG.EN
    ): Promise<void> {
        const formattedDate = deletionDate.toLocaleDateString(
            lang === LANG.UK ? 'uk-UA' : 'en-US',
            { year: 'numeric', month: 'long', day: 'numeric' }
        );

        const t =
            lang === LANG.UK
                ? {
                      subject: 'Ваш акаунт деактивовано',
                      body: `Ваш акаунт LucidShip деактивовано. Усі дані буде остаточно видалено <strong>${formattedDate}</strong>.`,
                      instruction:
                          'Щоб відновити акаунт, просто увійдіть протягом 30 днів.',
                      cta: 'Увійти',
                      footer: 'Якщо ви не запитували видалення — увійдіть у свій акаунт якомога швидше.',
                  }
                : {
                      subject: 'Your account has been deactivated',
                      body: `Your LucidShip account has been deactivated. All data will be permanently deleted on <strong>${formattedDate}</strong>.`,
                      instruction:
                          'To restore your account, simply sign in within 30 days.',
                      cta: 'Sign In',
                      footer: "If you didn't request deletion — sign in to your account as soon as possible.",
                  };

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
    <h1 style="font-size: 24px; color: #18181b; margin-bottom: 8px;">LucidShip</h1>
    <p style="color: #52525b; font-size: 16px; margin-bottom: 16px;">
      ${t.body}
    </p>
    <p style="color: #52525b; font-size: 16px; margin-bottom: 32px;">
      ${t.instruction}
    </p>
    <a href="${ENV.WEB_URL}/auth/signin"
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
                `Failed to send deletion confirmation to ${email}: ${error.message}`
            );
            throw new Error(`Failed to send email: ${error.message}`);
        }

        this.logger.log(`Deletion confirmation sent to ${email}`);
    }
}
