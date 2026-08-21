import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { fetchMetadata } from '@/shared/seo/metadata';
import { MetaProps, PageParams } from '@/shared/types/settings';
import {
    LANDING_SECTION_ANCHORS,
    LandingNav,
} from '@/features/agency/landing-nav';
import {
    HeroSection,
    ProblemSection,
    DogfoodingSection,
    DemoVideoSection,
    WorkflowSection,
    PricingSection,
    FooterCtaSection,
} from '@/widgets/agency/landing';
import { PortfolioSection } from '@/widgets/agency/portfolio';
import { SiteFooter } from '@/widgets/agency/site-footer';

export async function generateMetadata(props: MetaProps): Promise<Metadata> {
    return await fetchMetadata({ ...props, page: 'landing', href: 'landing' });
}

export default async function HomePage({ params }: PageParams) {
    const { locale } = await params;
    setRequestLocale(locale);

    return (
        <>
            <LandingNav />
            <main>
                <HeroSection />
                <ProblemSection />
                <PortfolioSection />
                <DogfoodingSection />
                <DemoVideoSection />
                <WorkflowSection />
                <PricingSection />
                <FooterCtaSection />
            </main>
            <SiteFooter sectionAnchors={LANDING_SECTION_ANCHORS} />
        </>
    );
}
