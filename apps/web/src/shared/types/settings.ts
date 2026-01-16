import { TLang } from '@acw/types';

export const CTheme = {
    LIGHT: 'light',
    DARK: 'dark',
} as const;

export type TTheme = (typeof CTheme)[keyof typeof CTheme];

export interface IPageParams {
    params: Promise<{ locale: TLang }>;
}

interface IMeta {
    title: string;
    description: string;
}

export interface IMetaProps extends IPageParams {
    page: string | null;
    href: string;
    meta?: IMeta;
}
