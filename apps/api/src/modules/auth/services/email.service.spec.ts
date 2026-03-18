import { Test, TestingModule } from '@nestjs/testing';

import { EmailService } from './email.service';

jest.mock('../../../config/env', () => ({
    ENV: {
        RESEND_API_KEY: 'test-key',
        RESEND_FROM_EMAIL: 'CyanShip <test@resend.dev>',
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
                    subject: 'Вхід до CyanShip',
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
                    subject: 'Ласкаво просимо до CyanShip',
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
                    subject: 'Sign in to CyanShip',
                })
            );
            const html = sendSpy.mock.calls[0][0].html as string;
            expect(html).toContain('Sign In');
        });

        it('should use English register template', async () => {
            await emailService.sendMagicLink(email, token, 'register', 'en');

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Welcome to CyanShip',
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
                const expectedPath =
                    purpose === 'reset-password'
                        ? `/auth/reset-password?token=${token}`
                        : `/auth/verify?token=${token}`;
                expect(html).toContain(`http://localhost:3000${expectedPath}`);
            }
        });

        it('should fallback to en when unknown lang provided', async () => {
            await emailService.sendMagicLink(
                email,
                token,
                'login',
                'fr' as any
            );

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Sign in to CyanShip',
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

        it('should use English reset-password template', async () => {
            await emailService.sendMagicLink(
                email,
                token,
                'reset-password',
                'en'
            );

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Reset Your Password',
                })
            );
            const html = sendSpy.mock.calls[0][0].html as string;
            expect(html).toContain('Reset Password');
        });

        it('should use English delete-account template', async () => {
            await emailService.sendMagicLink(
                email,
                token,
                'delete-account',
                'en'
            );

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Confirm Account Deletion',
                })
            );
            const html = sendSpy.mock.calls[0][0].html as string;
            expect(html).toContain('Confirm Deletion');
        });
    });

    describe('sendDeletionConfirmation', () => {
        const email = 'user@example.com';
        const deletionDate = new Date('2026-03-29T12:00:00Z');

        it('should send UK deletion confirmation with correct subject', async () => {
            await emailService.sendDeletionConfirmation(
                email,
                deletionDate,
                'uk'
            );

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: email,
                    subject: 'Ваш акаунт деактивовано',
                })
            );
        });

        it('should send EN deletion confirmation with correct subject', async () => {
            await emailService.sendDeletionConfirmation(
                email,
                deletionDate,
                'en'
            );

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: email,
                    subject: 'Your account has been deactivated',
                })
            );
        });

        it('should include formatted deletion date in HTML', async () => {
            await emailService.sendDeletionConfirmation(
                email,
                deletionDate,
                'uk'
            );

            const html = sendSpy.mock.calls[0][0].html as string;
            // Date should be formatted in uk-UA locale
            expect(html).toContain('2026');
        });

        it('should include WEB_URL link for recovery', async () => {
            await emailService.sendDeletionConfirmation(
                email,
                deletionDate,
                'uk'
            );

            const html = sendSpy.mock.calls[0][0].html as string;
            expect(html).toContain('http://localhost:3000/auth/signin');
        });

        it('should use EN template for non-UK lang', async () => {
            await emailService.sendDeletionConfirmation(
                email,
                deletionDate,
                'fr' as any
            );

            expect(sendSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: 'Your account has been deactivated',
                })
            );
        });

        it('should throw error when Resend fails', async () => {
            sendSpy.mockResolvedValue({
                error: { message: 'Send failed' },
            });

            await expect(
                emailService.sendDeletionConfirmation(email, deletionDate, 'uk')
            ).rejects.toThrow('Failed to send email: Send failed');
        });
    });
});
