import { resolveTranslations } from '../src/modules/email/i18n/resolve';
import { DeletionReminderEmail } from '../src/modules/email/templates/deletion-reminder';

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
