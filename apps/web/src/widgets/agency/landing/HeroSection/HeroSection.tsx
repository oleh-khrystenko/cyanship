import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import UiButton from '@/shared/ui/UiButton';
import { HeroShipStage } from '../../hero-ship';
import { StartBriefButton } from '../../start-brief';

const HeroSection = () => {
    const t = useTranslations('landing_page.hero');
    const tBrand = useTranslations('brand');

    return (
        <section className="wide:grid wide:grid-rows-1 relative -mt-16 flex min-h-svh flex-col overflow-hidden">
            <HeroShipStage />

            <div className="wide:relative wide:col-start-1 wide:row-start-1 wide:py-20 container flex flex-1 items-center px-6 py-10">
                <div className="wide:mx-0 wide:max-w-hero-copy wide:text-left mx-auto max-w-2xl text-center">
                    <p className="text-foreground dark:text-primary wide:static wide:px-0 wide:pt-0 wide:text-left absolute inset-x-0 top-0 px-6 pt-20 text-center text-sm font-medium tracking-widest uppercase">
                        {tBrand('slogan')}
                    </p>

                    {/* Three deliberate lines, not a wrap: each is a whole step of the
                        promise — idea, revenue, deadline. `text-hero-stack` is the ramp
                        sized for exactly this shape, so no line ever breaks again and the
                        type can be large enough to fill the copy column. */}
                    <h1 className="text-hero-stack wide:text-hero-stack-wide wide:mt-6 font-bold tracking-tight">
                        <span className="block">{t('heading_line1')}</span>
                        <span className="block">{t('heading_line2')}</span>
                        <span className="block">{t('heading_line3')}</span>
                    </h1>

                    <p className="text-muted-foreground dark:text-foreground/80 text-hero-lead wide:text-hero-lead-wide mx-auto mt-6 max-w-3xl leading-relaxed">
                        {t('description')}
                    </p>

                    {/* `wide:w-max` keeps the pair on one line even when the copy column is
                        narrower than the two buttons — it may overhang the column, never the hull. */}
                    <div className="wide:w-max wide:flex-row wide:justify-start mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                        <StartBriefButton
                            variant="filled"
                            size="lg"
                            className="w-full font-semibold sm:w-auto"
                            IconRight={<ArrowRight />}
                        >
                            {t('cta_primary')}
                        </StartBriefButton>
                        <UiButton
                            as="link"
                            href="/billing"
                            variant="outline"
                            size="lg"
                            className="w-full sm:w-auto"
                        >
                            {t('cta_secondary')}
                        </UiButton>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HeroSection;
