import { resolveTranslations } from '../../i18n/resolve';
import { DeletionReminderEmail } from '../deletion-reminder';

const t = resolveTranslations('uk');

export default function Preview() {
    return (
        <DeletionReminderEmail
            signInUrl="http://localhost:3000/auth/signin"
            translations={t.deletionReminder}
            formattedDate="26 березня 2026"
            lang="uk"
        />
    );
}
