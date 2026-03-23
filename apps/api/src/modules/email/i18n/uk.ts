import { MAGIC_LINK_PURPOSE } from '@cyanship/types';

import type { EmailTranslations } from './types';

export const uk = {
    magicLink: {
        [MAGIC_LINK_PURPOSE.LOGIN]: {
            subject: 'Вхід до CyanShip',
            body: 'Натисніть кнопку нижче, щоб увійти у ваш акаунт.',
            cta: 'Увійти',
            footer: 'Посилання дійсне 15 хвилин. Якщо ви не запитували вхід — ігноруйте цей лист.',
        },
        [MAGIC_LINK_PURPOSE.REGISTER]: {
            subject: 'Ласкаво просимо до CyanShip',
            body: 'Натисніть кнопку нижче, щоб завершити реєстрацію.',
            cta: 'Завершити реєстрацію',
            footer: 'Посилання дійсне 15 хвилин. Якщо ви не реєструвалися — ігноруйте цей лист.',
        },
        [MAGIC_LINK_PURPOSE.RESET_PASSWORD]: {
            subject: 'Скидання пароля',
            body: 'Натисніть кнопку нижче, щоб скинути пароль.',
            cta: 'Скинути пароль',
            footer: 'Посилання дійсне 15 хвилин. Якщо ви не запитували скидання — ігноруйте цей лист.',
        },
        [MAGIC_LINK_PURPOSE.DELETE_ACCOUNT]: {
            subject: 'Підтвердження видалення акаунту',
            body: 'Натисніть кнопку нижче, щоб підтвердити видалення акаунту.',
            cta: 'Підтвердити видалення',
            footer: 'Посилання дійсне 15 хвилин. Якщо ви не запитували видалення — ігноруйте цей лист.',
        },
    },
    deletionConfirmation: {
        subject: 'Ваш акаунт деактивовано',
        body: (formattedDate: string) =>
            `Ваш акаунт CyanShip деактивовано. Усі дані буде остаточно видалено ${formattedDate}.`,
        instruction: (graceDays: number) => {
            const dayWord =
                graceDays === 1
                    ? 'день'
                    : graceDays >= 2 && graceDays <= 4
                      ? 'дні'
                      : 'днів';
            return `Щоб відновити акаунт, просто увійдіть протягом ${graceDays} ${dayWord}.`;
        },
        cta: 'Увійти',
        footer: 'Якщо ви не запитували видалення — увійдіть у свій акаунт якомога швидше.',
    },
    deletionReminder: {
        subject: 'Ваш акаунт буде видалено завтра',
        body: (formattedDate: string) =>
            `Ваш акаунт CyanShip буде остаточно видалено ${formattedDate}.`,
        instruction: 'Щоб зберегти акаунт, просто увійдіть до дати видалення.',
        cta: 'Увійти',
        footer: 'Якщо ви не запитували видалення — увійдіть у свій акаунт якомога швидше.',
    },
} satisfies EmailTranslations;
