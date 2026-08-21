/**
 * The portfolio has no database table and no admin screen behind it: a handful
 * of entries that change a few times a year earn neither. Copy lives in
 * `portfolio.cases.<slug>` in both locales, images ship with the
 * repo, and this file holds the part that is neither — the shape of each
 * entry.
 *
 * Two shapes share the grid. A `work` is a finished product, shown through its
 * own screens. A `comparison` is a first screen rewritten next to the one it
 * replaces. There are no comparisons yet — they arrive with the outreach
 * drafts — so the union exists before the data does, and the grid already
 * knows how to render both.
 */
export const PORTFOLIO_ITEM_TYPE = {
    WORK: 'work',
    COMPARISON: 'comparison',
} as const;

interface PortfolioWork {
    type: typeof PORTFOLIO_ITEM_TYPE.WORK;
    /** i18n key under `portfolio.cases` and the image folder name. */
    slug: string;
    /** How many screens sit in `/images/portfolio/<slug>/`, numbered from 1. */
    screens: number;
    /** Live site — set only where the client has confirmed it may be linked. */
    href?: string;
    /** Screens were rebuilt for the case because the originals are under NDA. */
    ndaNote?: boolean;
}

interface PortfolioComparison {
    type: typeof PORTFOLIO_ITEM_TYPE.COMPARISON;
    slug: string;
    beforeSrc: string;
    afterSrc: string;
}

export type PortfolioItem = PortfolioWork | PortfolioComparison;

/** Every screenshot is exported at this size, so one ratio covers the grid. */
export const PORTFOLIO_IMAGE_WIDTH = 1448;
export const PORTFOLIO_IMAGE_HEIGHT = 1086;

/**
 * Mirrors the slide width classes in `PortfolioCarousel` — `w-72 sm:w-80
 * lg:w-96`. Change the two together or the browser picks the wrong file.
 */
export const PORTFOLIO_CARD_SIZES =
    '(min-width: 1024px) 384px, (min-width: 640px) 320px, 288px';

/**
 * What a live link shows: the domain itself, without scheme or `www.`. Derived
 * from the address rather than stored beside it — a label and a link that can
 * disagree eventually will.
 */
export const siteLabel = (href: string) =>
    new URL(href).hostname.replace(/^www\./, '');

export const screenSrc = (slug: string, index: number) =>
    `/images/portfolio/${slug}/${index}.webp`;

export const PORTFOLIO_ITEMS: PortfolioItem[] = [
    {
        type: PORTFOLIO_ITEM_TYPE.WORK,
        slug: 'status',
        screens: 5,
        ndaNote: true,
        href: 'https://status.pl.ua',
    },
    {
        type: PORTFOLIO_ITEM_TYPE.WORK,
        slug: 'finly',
        screens: 5,
        href: 'https://finly.com.ua',
    },
    {
        type: PORTFOLIO_ITEM_TYPE.WORK,
        slug: 'wish-hub',
        screens: 5,
        href: 'https://wish-hub.net',
    },
    {
        type: PORTFOLIO_ITEM_TYPE.WORK,
        slug: 'buildup-school',
        screens: 5,
        ndaNote: true,
    },
    { type: PORTFOLIO_ITEM_TYPE.WORK, slug: 'knockai', screens: 5 },
    { type: PORTFOLIO_ITEM_TYPE.WORK, slug: 'split', screens: 5 },
    { type: PORTFOLIO_ITEM_TYPE.WORK, slug: 'cycle8', screens: 5 },
];
