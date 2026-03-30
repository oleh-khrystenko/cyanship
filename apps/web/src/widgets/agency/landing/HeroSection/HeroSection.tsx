import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import UiButton from '@/shared/ui/UiButton';
import StartBriefButton from '../StartBriefButton';

const HeroSection = () => {
    const t = useTranslations('landing_page.hero');
    const tBrand = useTranslations('brand');

    return (
        <section className="relative -mt-16 flex min-h-svh items-center overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
            {/* Ambient glow — radial gradient instead of blur for consistent cross-browser rendering */}
            <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
            >
                <div className="absolute top-1/3 left-1/2 size-[min(48rem,100vw)] -translate-x-1/2 -translate-y-1/2 dark:hidden"
                    style={{ background: 'radial-gradient(circle, oklch(0.65 0.16 195 / 0.04) 0%, transparent 70%)' }}
                />
                <div className="absolute top-1/3 left-1/2 size-[min(48rem,100vw)] -translate-x-1/2 -translate-y-1/2 hidden dark:block"
                    style={{ background: 'radial-gradient(circle, oklch(0.70 0.18 195 / 0.07) 0%, transparent 70%)' }}
                />
                <div className="absolute top-1/3 left-1/2 size-[min(28rem,70vw)] -translate-x-1/2 -translate-y-1/2 dark:hidden"
                    style={{ background: 'radial-gradient(circle, oklch(0.65 0.16 195 / 0.03) 0%, transparent 60%)' }}
                />
                <div className="absolute top-1/3 left-1/2 size-[min(28rem,70vw)] -translate-x-1/2 -translate-y-1/2 hidden dark:block"
                    style={{ background: 'radial-gradient(circle, oklch(0.70 0.18 195 / 0.05) 0%, transparent 60%)' }}
                />
            </div>

            <div className="relative container px-6">
                <div className="mx-auto max-w-3xl text-center">
                    <p className="text-primary text-sm font-medium tracking-widest uppercase">
                        {tBrand('slogan')}
                    </p>

                    <h1 className="mt-6 text-3xl font-bold tracking-tight min-[412px]:text-4xl md:text-5xl lg:text-6xl">
                        {t('heading_line1')}
                        <br />
                        {t('heading_line2')}
                    </h1>

                    <p className="text-muted-foreground mx-auto mt-6 max-w-3xl text-lg leading-relaxed md:text-xl">
                        {t('description')}
                    </p>

                    <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
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
