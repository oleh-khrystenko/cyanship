import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { StartBriefButton } from '../../start-brief';

const FinalCtaSection = () => {
    const t = useTranslations('home_page.final_cta');

    return (
        <section
            id="start"
            className="border-border scroll-mt-16 border-t py-24"
        >
            <div className="container px-6">
                <div className="mx-auto max-w-2xl text-center">
                    <span className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
                        {t('label')}
                    </span>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                        {t('heading')}
                    </h2>
                    <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
                        {t('description')}
                    </p>
                    <StartBriefButton
                        variant="filled"
                        size="lg"
                        className="mt-10 w-full font-semibold sm:w-auto"
                        IconRight={<ArrowRight />}
                    >
                        {t('cta')}
                    </StartBriefButton>
                </div>
            </div>
        </section>
    );
};

export default FinalCtaSection;
