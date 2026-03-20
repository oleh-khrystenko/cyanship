import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import UiButton from '@/shared/ui/UiButton';

const HeroSection = () => {
    const t = useTranslations('landing_page.hero');
    const tBrand = useTranslations('brand');

    return (
        <section className="flex min-h-[calc(100svh-4rem)] items-center py-20 md:py-28">
            <div className="container px-6">
                <div className="mx-auto max-w-3xl text-center">
                    <p className="text-sm font-medium tracking-widest text-primary uppercase">
                        {tBrand('slogan')}
                    </p>

                    <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                        {t('heading')}
                    </h1>

                    <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
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
                            variant="text"
                            size="lg"
                            className="h-12 text-base text-muted-foreground hover:text-foreground"
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
