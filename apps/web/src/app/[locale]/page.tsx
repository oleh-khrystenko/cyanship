import { Metadata } from 'next';
import { fetchMetadata } from '@/shared/seo/metadata';
import { MetaProps } from '@/shared/types/settings';
import {
    HeroSection,
    ProblemSection,
    DogfoodingSection,
    PortfolioSection,
    WorkflowSection,
    PricingSection,
    FooterCtaSection,
    LandingFooter,
} from '@/widgets/landing';

export async function generateMetadata(props: MetaProps): Promise<Metadata> {
    return await fetchMetadata({ ...props, page: 'landing', href: 'landing' });
}

export default function HomePage() {
    return (
        <main>
            <HeroSection />
            <ProblemSection />
            <DogfoodingSection />
            <PortfolioSection />
            <WorkflowSection />
            <PricingSection />
            <FooterCtaSection />
            <LandingFooter />
        </main>
    );
}
