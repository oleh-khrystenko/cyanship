import { useLocale, useTranslations } from 'next-intl';
import UiLink from '@/shared/ui/UiLink';
import {
    LANDING_SECTION_ANCHORS,
    type SectionAnchors,
} from '@/features/agency/landing-nav';

/** Which of the home page's sections the product column lists, in its order. */
const NAV_KEYS = ['work', 'pricing', 'demo', 'proof'] as const;

/**
 * Resolved against the home page, because that is where a link travels when the
 * section is not on the current page. A key the home page does not render —
 * `demo` while the demo video is switched off — drops out of the column here,
 * so the list never has to repeat the condition that removed the section.
 */
const navItems = NAV_KEYS.flatMap((key) => {
    const homeAnchor = LANDING_SECTION_ANCHORS[key];
    return homeAnchor ? [{ key, homeAnchor }] : [];
});

interface FooterNavLinksProps {
    /**
     * Which anchor each section carries on the surrounding page, handed down
     * from that page. Empty on the legal pages, which have no sections of their
     * own.
     */
    sectionAnchors: SectionAnchors;
}

/**
 * The same product column on every page, but each link resolved against the
 * page it is printed on: bare where the section is right here and it only has
 * to scroll, prefixed with the home address where it has to travel first.
 *
 * The decision is made from the page's own section list rather than from its
 * path — the parked rebuild offer carries some of these sections and not
 * others, and matching on "is this the home page" would send a reader of that
 * offer to the other one's pricing. The lookup is by section key rather than by
 * anchor string, because the same section is anchored differently per offer
 * (`proof` is `#dogfooding` on the landing, `#proof` on the rebuild page) and
 * matching on the anchor would walk a reader off a page that has the section
 * right there. It is also made on the server, so the very first click, before
 * any script has run, already goes to the right place.
 */
const FooterNavLinks = ({ sectionAnchors }: FooterNavLinksProps) => {
    const t = useTranslations('site_footer');
    const locale = useLocale();

    return (
        <ul className="mt-1 space-y-0.5">
            {navItems.map(({ key, homeAnchor }) => (
                <li key={key}>
                    {/* `min-h-11` — the 44px floor from
                        `docs/conventions/responsive.md`. A footer link is a
                        20px line of text, so the tap area is carried by the
                        link itself rather than by the gap between rows; the
                        list spacing shrinks to match, and the column keeps the
                        rhythm it had. */}
                    <UiLink
                        as="link"
                        href={sectionAnchors[key] ?? `/${locale}${homeAnchor}`}
                        variant="muted"
                        className="inline-flex min-h-11 items-center text-sm"
                    >
                        {t(`nav_${key}`)}
                    </UiLink>
                </li>
            ))}
        </ul>
    );
};

export default FooterNavLinks;
