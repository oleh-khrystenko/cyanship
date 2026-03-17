import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import UiButton from '@/shared/ui/UiButton';
import CodeVisual from './CodeVisual';

const HeroSection = () => {
    const t = useTranslations('landing_page.hero');

    return (
        <section className="flex min-h-[calc(100svh-4rem)] items-center py-16 md:py-20">
            <div className="container px-6">
                <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                    {/* Content */}
                    <div>
                        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                            {t('heading')}
                        </h1>
                        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                            {t('description')}
                        </p>
                        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
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

                    {/* Code Visual */}
                    <CodeVisual />
                </div>
            </div>
        </section>
    );
};

export default HeroSection;
