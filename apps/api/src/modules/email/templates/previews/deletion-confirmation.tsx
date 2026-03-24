import { resolveTranslations } from '../../i18n/resolve';
import { DeletionConfirmationEmail } from '../deletion-confirmation';

const t = resolveTranslations('uk');

export default function Preview() {
    return (
        <DeletionConfirmationEmail
            signInUrl="http://localhost:3000/auth/signin"
            translations={{
                ...t.deletionConfirmation,
                instruction: t.deletionConfirmation.instruction(2),
            }}
            formattedDate="26 березня 2026"
            lang="uk"
        />
    );
}
