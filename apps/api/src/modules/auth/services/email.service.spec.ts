import { Test, TestingModule } from '@nestjs/testing';

import { EmailService } from './email.service';

jest.mock('../../../config/env', () => ({
    ENV: {
        RESEND_API_KEY: 'test-key',
        RESEND_FROM_EMAIL: 'LucidKit <test@resend.dev>',
        WEB_URL: 'http://localhost:3000',
    },
}));

jest.mock('resend', () => ({
    Resend: jest.fn().mockImplementation(() => ({
        emails: {
            send: jest.fn().mockResolvedValue({ error: null }),
        },
    })),
}));

describe('EmailService', () => {
    let emailService: EmailService;
    let sendSpy: jest.Mock;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [EmailService],
        }).compile();

        emailService = module.get<EmailService>(EmailService);
        sendSpy = (emailService as any).resend.emails.send;
        jest.clearAllMocks();
    });

    describe('sendMagicLink', () => {
        const email = 'user@example.com';
        const token = 'abc123';

        it('should use login template for purpose login (uk)', async () => {
            await emailService.sendMagicLink(email, token, 'login', 'uk');

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: email,
                    subject: 'Вхід до LucidKit',
                })
            );
            const html = sendSpy.mock.calls[0][0].html as string;
            expect(html).toContain('Увійти');
            expect(html).toContain(`token=${token}`);
        });

        it('should use register template for purpose register (uk)', async () => {
            await emailService.sendMagicLink(email, token, 'register', 'uk');

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Ласкаво просимо до LucidKit',
                })
            );
            const html = sendSpy.mock.calls[0][0].html as string;
            expect(html).toContain('Завершити реєстрацію');
        });

        it('should use reset-password template (uk)', async () => {
            await emailService.sendMagicLink(
                email,
                token,
                'reset-password',
                'uk'
            );

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Скидання пароля',
                })
            );
            const html = sendSpy.mock.calls[0][0].html as string;
            expect(html).toContain('Скинути пароль');
        });

        it('should use delete-account template (uk)', async () => {
            await emailService.sendMagicLink(
                email,
                token,
                'delete-account',
                'uk'
            );

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Підтвердження видалення акаунту',
                })
            );
            const html = sendSpy.mock.calls[0][0].html as string;
            expect(html).toContain('Підтвердити видалення');
            expect(html).toContain('30 днів');
        });

        it('should use English templates when lang is en', async () => {
            await emailService.sendMagicLink(email, token, 'login', 'en');

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Sign in to LucidKit',
                })
            );
            const html = sendSpy.mock.calls[0][0].html as string;
            expect(html).toContain('Sign In');
        });

        it('should use English register template', async () => {
            await emailService.sendMagicLink(email, token, 'register', 'en');

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Welcome to LucidKit',
                })
            );
            const html = sendSpy.mock.calls[0][0].html as string;
            expect(html).toContain('Complete Registration');
        });

        it('should include token in link for all purposes', async () => {
            const purposes = [
                'login',
                'register',
                'reset-password',
                'delete-account',
            ] as const;

            for (const purpose of purposes) {
                sendSpy.mockClear();
                await emailService.sendMagicLink(email, token, purpose, 'uk');

                const html = sendSpy.mock.calls[0][0].html as string;
                expect(html).toContain(
                    `http://localhost:3000/auth/verify?token=${token}`
                );
            }
        });

        it('should fallback to uk when unknown lang provided', async () => {
            await emailService.sendMagicLink(
                email,
                token,
                'login',
                'fr' as any
            );

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Вхід до LucidKit',
                })
            );
        });

        it('should throw error when Resend fails', async () => {
            sendSpy.mockResolvedValue({
                error: { message: 'Send failed' },
            });

            await expect(
                emailService.sendMagicLink(email, token, 'login', 'uk')
            ).rejects.toThrow('Failed to send email: Send failed');
        });
    });
});
