import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import UiButton from '@/shared/ui/UiButton';

const HeroSection = () => {
    const t = useTranslations('landing_page.hero');
    const tBrand = useTranslations('brand');

    return (
        <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden py-20 md:py-28">
            {/* Ambient glow — backlighting effect */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="absolute left-1/2 top-1/3 size-[min(36rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.03] blur-[120px] dark:bg-primary/[0.05]" />
                <div className="absolute left-1/2 top-1/3 size-[min(20rem,60vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.02] blur-[80px] dark:bg-primary/[0.035]" />
            </div>

            <div className="relative container px-6">
                <div className="mx-auto max-w-3xl text-center">
                    <p className="text-sm font-medium tracking-widest text-primary uppercase">
                        {tBrand('slogan')}
                    </p>

                    <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                        {t('heading')}
                    </h1>

                    <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                        {t('description')}
                    </p>

                    <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <UiButton
                            as="a"
                            href="#pricing"
                            variant="filled"
                            size="lg"
                            className="h-12 px-8 text-base font-semibold"
                            IconRight={<ArrowRight />}
                        >
                            {t('cta_primary')}
                        </UiButton>
                        <UiButton
                            as="link"
                            href="/auth/signin"
                            variant="outline"
                            size="lg"
                            className="h-12 px-8 text-base"
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
