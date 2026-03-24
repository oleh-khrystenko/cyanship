import { MAGIC_LINK_PURPOSE } from '@cyanship/types';

import { resolveTranslations } from '../../i18n/resolve';
import { MagicLinkEmail } from '../magic-link';

const t = resolveTranslations('uk');

export default function Preview() {
    return (
        <MagicLinkEmail
            link="http://localhost:3000/auth/verify?token=preview"
            translations={t.magicLink[MAGIC_LINK_PURPOSE.DELETE_ACCOUNT]}
            lang="uk"
        />
    );
}
