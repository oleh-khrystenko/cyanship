import { defineRouting } from 'next-intl/routing';
import { LANG } from '@bidguard/types';

export const routing = defineRouting({
    locales: Object.values(LANG),

    defaultLocale: LANG.UK,
});
