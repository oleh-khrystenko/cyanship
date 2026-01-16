import { defineRouting } from 'next-intl/routing';
import { CLang } from '@acw/types';

export const routing = defineRouting({
    locales: Object.values(CLang),

    defaultLocale: CLang.UK,
});
