import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { fetchMetadata } from '@/shared/seo/metadata';
import { MetaProps, PageParams } from '@/shared/types/settings';
import {
    REBUILD_SECTION_ANCHORS,
    RebuildNav,
} from '@/features/agency/landing-nav';
import {
    HeroSection,
    HowItWorksSection,
    PricingSection,
    LadderSection,
    ProofSection,
    FinalCtaSection,
} from '@/widgets/agency/home';
import { PortfolioSection } from '@/widgets/agency/portfolio';
import { SiteFooter } from '@/widgets/agency/site-footer';

/**
 * The rebuild offer — a site redone for a business that already runs — kept
 * whole at its own address while the MVP offer holds the home page.
 *
 * Nothing links here: not the header, not the footer, not the home page. It is
 * reachable by typing the URL, which is exactly the point — the direction is
 * parked rather than deleted, and the full version stays readable until it is
 * clear whether it comes back.
 *
 * Indexing is refused in the page metadata, so the two offers never compete
 * for the same query. There is no sitemap in the project, so metadata is the
 * only place a robots directive can live.
 */
export async function generateMetadata(props: MetaProps): Promise<Metadata> {
    const metadata = await fetchMetadata({
        ...props,
        page: 'home',
        href: 'rebuild',
    });

    return {
        ...metadata,
        robots: { index: false, follow: false },
    };
}

export default async function RebuildOfferPage({ params }: PageParams) {
    const { locale } = await params;
    setRequestLocale(locale);

    return (
        <>
            <RebuildNav />
            <main>
                <HeroSection />
                <PortfolioSection />
                <HowItWorksSection />
                <PricingSection />
                <LadderSection />
                <ProofSection />
                <FinalCtaSection />
            </main>
            <SiteFooter sectionAnchors={REBUILD_SECTION_ANCHORS} />
        </>
    );
}
