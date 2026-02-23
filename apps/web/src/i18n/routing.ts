import { defineRouting } from 'next-intl/routing';
import { LANG } from '@lucidkit/types';

export const routing = defineRouting({
    locales: Object.values(LANG),

    defaultLocale: LANG.UK,
});
