export interface IPageParams {
    params: Promise<{ locale: string }>;
}

interface IMeta {
    title: string;
    description: string;
}

export interface IMetaProps {
    locale: string;
    page: string | null;
    href: string;
    meta?: IMeta;
}
