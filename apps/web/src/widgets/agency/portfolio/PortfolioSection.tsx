import { useTranslations } from 'next-intl';
import PortfolioCarousel from './PortfolioCarousel';

const PortfolioSection = () => {
    const t = useTranslations('portfolio');

    return (
        <section
            id="work"
            className="border-border scroll-mt-16 border-t py-24"
        >
            <div className="container px-6">
                <div className="max-w-2xl">
                    <span className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
                        {t('label')}
                    </span>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                        {t('heading')}
                    </h2>
                    <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
                        {t('description')}
                    </p>
                </div>
            </div>

            <PortfolioCarousel />
        </section>
    );
};

export default PortfolioSection;
