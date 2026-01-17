import { Metadata } from 'next';
import { IMetaProps } from '@/shared/types/settings';
import { CLang } from '@acw/types';

export async function fetchMetadata({
    locale,
    page,
    href,
    meta,
}: IMetaProps): Promise<Metadata> {
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

    if (!BASE_URL) {
        console.error('❌ NEXT_PUBLIC_BASE_URL is not defined');
        // Do not throw to avoid crashing build if env missing (optional safe fallback?)
        // throw new Error('❌ NEXT_PUBLIC_BASE_URL is not defined');
    }

    if (!locale) {
        console.error('❌ Locale is missing in fetchMetadata');
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
    const baseUrl = BASE_URL || 'http://localhost:3000';

    return {
        title,
        description,
        alternates: {
            canonical: `${baseUrl}/${locale}${path}`,
            languages: {
                'x-default': `${baseUrl}/uk${path}`,
                'uk-ua': `${baseUrl}/uk${path}`,
                'en-ua': `${baseUrl}/en${path}`,
            },
        },
    };
}
