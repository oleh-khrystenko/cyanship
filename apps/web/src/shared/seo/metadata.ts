import { Metadata } from 'next';
import { IMetaProps } from '@/shared/types/settings';
import { CLang } from '@acw/types';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

if (!BASE_URL) {
    throw new Error('❌ NEXT_PUBLIC_BASE_URL is not defined');
}

export async function fetchMetadata({
    params,
    page,
    href,
    meta,
}: IMetaProps): Promise<Metadata> {
    let locale: string;

    try {
        const resolved = await params;
        locale = resolved?.locale;
        if (!locale) throw new Error('Locale is missing in params');
    } catch (error) {
        console.error('❌ Failed to resolve locale from params:', error);
        locale = CLang.UK;
    }

    let title = 'Lucid Kit — Створи відчуття, що не зникає';
    let description =
        'Онлайн-сервіс для створення персоналізованих wow-привітань у вигляді красивих сторінок. Без реєстрацій і зайвого — просто обери подію, введи ім’я та отримай емоційне привітання за кілька секунд.';

    if (page === null) {
        if (meta) {
            title = meta.title;
            description = meta.description;
        }
    } else {
        const raw = String(locale ?? '').toLowerCase();
        const normalized = /^[a-z]{2}(-[a-z]{2})?$/i.test(raw) ? raw : CLang.UK;

        async function importMessages(loc: string) {
            try {
                const mod = await import(`../../../messages/${loc}.json`);
                return (mod as any).default ?? mod;
            } catch {
                if (loc !== CLang.UK) {
                    const modUk = await import(
                        `../../../messages/${CLang.UK}.json`
                    );
                    return (modUk as any).default ?? modUk;
                }
                return {};
            }
        }

        const messages: any = await importMessages(normalized);
        const metaT = (key: string) => messages?.[key] ?? {};

        title = metaT(`${page}_page`)?.head?.title ?? title;
        description = metaT(`${page}_page`)?.head?.description ?? description;
    }

    const path = href === 'welcome' ? '' : `/${href}`;

    return {
        title,
        description,
        alternates: {
            canonical: `${BASE_URL}/${locale}${path}`,
            languages: {
                'x-default': `${BASE_URL}/uk${path}`,
                'uk-ua': `${BASE_URL}/uk${path}`,
                'en-ua': `${BASE_URL}/en${path}`,
            },
        },
    };
}
