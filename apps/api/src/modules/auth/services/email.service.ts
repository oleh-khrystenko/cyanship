import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

import { ENV } from '../../../config/env';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly resend = new Resend(ENV.RESEND_API_KEY);

    async sendMagicLink(email: string, token: string): Promise<void> {
        const link = `${ENV.WEB_URL}/auth/verify?token=${token}`;

        const { error } = await this.resend.emails.send({
            from: ENV.RESEND_FROM_EMAIL,
            to: email,
            subject: 'Вхід у BidGuard',
            html: `
<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; background: #f4f4f5; padding: 40px 0;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; text-align: center;">
    <h1 style="font-size: 24px; color: #18181b; margin-bottom: 8px;">BidGuard</h1>
    <p style="color: #52525b; font-size: 16px; margin-bottom: 32px;">
      Натисніть кнопку нижче, щоб увійти у ваш акаунт.
    </p>
    <a href="${link}"
       style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
              padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
      Увійти в BidGuard
    </a>
    <p style="color: #a1a1aa; font-size: 13px; margin-top: 32px;">
      Посилання дійсне 15 хвилин. Якщо ви не запитували вхід — ігноруйте цей лист.
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
