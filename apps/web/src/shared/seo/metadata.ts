import { Metadata } from 'next';
import { MetaProps } from '@/shared/types/settings';
import { LANG } from '@cyanship/types';
import { ENV } from '@/shared/config';

const BASE_URL = ENV.NEXT_PUBLIC_BASE_URL;

export async function fetchMetadata({
    params,
    page,
    href,
    meta,
}: MetaProps): Promise<Metadata> {
    let locale: string;

    try {
        const resolved = await params;
        locale = resolved?.locale;
        if (!locale) throw new Error('Locale is missing in params');
    } catch (error) {
        console.error('❌ Failed to resolve locale from params:', error);
        locale = LANG.EN;
    }

    // Last resort for a page that ships without its own `head` keys. English,
    // because that is the language the copy is written in first; and it names
    // the current offer, because a stale default is exactly how a retired one
    // creeps back in front of a customer.
    let title = 'CyanShip – From Idea to Revenue in 4 Weeks';
    let description =
        'B2B platform development with AI, payments, and auth built in. Next.js + NestJS. Fast time-to-market, zero agency overhead.';

    if (page === null) {
        if (meta) {
            title = meta.title;
            description = meta.description;
        }
    } else {
        const raw = String(locale ?? '').toLowerCase();
        const normalized = /^[a-z]{2}(-[a-z]{2})?$/i.test(raw) ? raw : LANG.EN;

        interface PageMessages {
            head?: { title?: string; description?: string };
        }

        type Messages = Record<string, PageMessages>;

        async function importMessages(loc: string): Promise<Messages> {
            try {
                const mod = await import(`../../../messages/${loc}.json`);
                return mod.default ?? mod;
            } catch {
                // Same fallback language as everything else in this function:
                // an English URL must never come back with Ukrainian head copy.
                if (loc !== LANG.EN) {
                    const fallback = await import(
                        `../../../messages/${LANG.EN}.json`
                    );
                    return fallback.default ?? fallback;
                }
                return {};
            }
        }

        const messages = await importMessages(normalized);
        const pageData = messages[`${page}_page`];

        title = pageData?.head?.title ?? title;
        description = pageData?.head?.description ?? description;
    }

    const path = href === 'landing' ? '' : `/${href}`;

    const canonicalUrl = `${BASE_URL}/${locale}${path}`;

    return {
        title,
        description,
        alternates: {
            canonical: canonicalUrl,
            // Plain language codes, no region: the offer is sold in England,
            // Austria and the United States, so pinning English to a single
            // country would leave every other English-speaking market matched
            // by nothing. `x-default` follows `routing.defaultLocale`, which is
            // English — the language the copy is written in first.
            languages: {
                'x-default': `${BASE_URL}/${LANG.EN}${path}`,
                [LANG.EN]: `${BASE_URL}/${LANG.EN}${path}`,
                [LANG.UK]: `${BASE_URL}/${LANG.UK}${path}`,
            },
        },
        openGraph: {
            title,
            description,
            url: canonicalUrl,
            siteName: 'CyanShip',
            locale: locale === 'uk' ? 'uk_UA' : 'en_US',
            type: 'website',
            // JPEG, not PNG: the banner is a photograph with no transparency,
            // and several scrapers — WhatsApp most visibly — skip the preview
            // entirely once the image passes a few hundred kilobytes. The same
            // artwork as PNG weighed a megabyte, so every share fetched that
            // and half of them showed nothing.
            images: [
                {
                    url: `${BASE_URL}/images/og-banner.jpg`,
                    width: 1200,
                    height: 630,
                    type: 'image/jpeg',
                    alt: title,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [`${BASE_URL}/images/og-banner.jpg`],
        },
    };
}
