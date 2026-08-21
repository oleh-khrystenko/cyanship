import { DEMO_VIDEO_ENABLED } from '@/shared/config/env';

/**
 * Which sections each public page actually renders, written once.
 *
 * The header nav builds its items from these lists, and the footer asks them
 * under which anchor a given section lives on the page it is currently
 * rendered on — a footer link that scrolls where the section exists and
 * travels home where it does not. The lookup is by section key, not by anchor
 * string: the same section can carry a different anchor on each offer (`proof`
 * is `#dogfooding` on the landing and `#proof` on the rebuild page), and a
 * footer matching on the raw anchor would leave a page whose section is right
 * there under another name.
 */
const allLandingItems = [
    { key: 'approach', href: '#problem' },
    { key: 'work', href: '#work' },
    { key: 'proof', href: '#dogfooding' },
    { key: 'demo', href: '#demo', enabled: DEMO_VIDEO_ENABLED },
    { key: 'workflow', href: '#workflow' },
    { key: 'pricing', href: '#pricing' },
    { key: 'get_started', href: '#footer-cta' },
] as const;

export const LANDING_NAV_ITEMS = allLandingItems.filter(
    (item) => !('enabled' in item) || item.enabled
);

export const REBUILD_NAV_ITEMS = [
    { key: 'work', href: '#work' },
    { key: 'process', href: '#process' },
    { key: 'pricing', href: '#pricing' },
    { key: 'proof', href: '#proof' },
] as const;

/**
 * Section key → the anchor it carries on one particular page. A key that the
 * page does not render is simply absent, which is what lets a consumer tell
 * "here, under this anchor" from "not on this page at all".
 */
export type SectionAnchors = Readonly<Record<string, string | undefined>>;

const anchorsOf = (
    items: readonly { key: string; href: string }[]
): SectionAnchors =>
    Object.fromEntries(items.map(({ key, href }) => [key, href]));

export const LANDING_SECTION_ANCHORS = anchorsOf(LANDING_NAV_ITEMS);

export const REBUILD_SECTION_ANCHORS = anchorsOf(REBUILD_NAV_ITEMS);
