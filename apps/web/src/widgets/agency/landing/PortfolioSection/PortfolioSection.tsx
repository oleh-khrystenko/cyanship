import { useTranslations } from 'next-intl';
import { Play } from 'lucide-react';

const PortfolioSection = () => {
    const t = useTranslations('landing_page.portfolio');

    return (
        <section id="portfolio" className="scroll-mt-16 border-t border-border py-24">
            <div className="container px-6">
                <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                    {/* Text */}
                    <div>
                        <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                            {t('label')}
                        </span>
                        <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                            {t('heading')}
                        </h2>
                        <div className="mt-6 max-w-lg space-y-4 text-lg leading-relaxed text-muted-foreground">
                            <p>{t('paragraph_1')}</p>
                            <p>{t('paragraph_2')}</p>
                        </div>
                    </div>

                    {/* Video placeholder */}
                    <div className="flex aspect-video cursor-pointer items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-secondary">
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex size-16 items-center justify-center rounded-full bg-foreground">
                                <Play className="ml-1 size-6 text-background" />
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {t('video_label')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PortfolioSection;
