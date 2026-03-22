import { MAGIC_LINK_PURPOSE } from '@cyanship/types';

import type { EmailTranslations } from './types';

export const en = {
    magicLink: {
        [MAGIC_LINK_PURPOSE.LOGIN]: {
            subject: 'Sign in to CyanShip',
            body: 'Click the button below to sign in to your account.',
            cta: 'Sign In',
            footer: "This link expires in 15 minutes. If you didn't request this — ignore this email.",
        },
        [MAGIC_LINK_PURPOSE.REGISTER]: {
            subject: 'Welcome to CyanShip',
            body: 'Click the button below to complete your registration.',
            cta: 'Complete Registration',
            footer: "This link expires in 15 minutes. If you didn't sign up — ignore this email.",
        },
        [MAGIC_LINK_PURPOSE.RESET_PASSWORD]: {
            subject: 'Reset Your Password',
            body: 'Click the button below to reset your password.',
            cta: 'Reset Password',
            footer: "This link expires in 15 minutes. If you didn't request a reset — ignore this email.",
        },
        [MAGIC_LINK_PURPOSE.DELETE_ACCOUNT]: {
            subject: 'Confirm Account Deletion',
            body: 'Click the button below to confirm account deletion. After confirmation, you will have 30 days to recover your account — just sign in during that time.',
            cta: 'Confirm Deletion',
            footer: "This link expires in 15 minutes. If you didn't request deletion — ignore this email.",
        },
    },
    deletionConfirmation: {
        subject: 'Your account has been deactivated',
        body: (formattedDate: string) =>
            `Your CyanShip account has been deactivated. All data will be permanently deleted on ${formattedDate}.`,
        instruction: 'To restore your account, simply sign in within 30 days.',
        cta: 'Sign In',
        footer: "If you didn't request deletion — sign in to your account as soon as possible.",
    },
} satisfies EmailTranslations;
