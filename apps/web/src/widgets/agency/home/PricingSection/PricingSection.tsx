import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { StartBriefButton } from '../../start-brief';

const includeKeys = [
    'include_1',
    'include_2',
    'include_3',
    'include_4',
    'include_5',
] as const;

/**
 * "From $1,000" on its own reads as bait, so the number never appears without
 * the list of what the lower end actually buys — and without the sentence that
 * says why there is no upper end.
 */
const PricingSection = () => {
    const t = useTranslations('home_page.pricing');

    return (
        <section
            id="pricing"
            className="border-border scroll-mt-16 border-t py-24"
        >
            <div className="container px-6">
                <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
                    <div>
                        <span className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
                            {t('label')}
                        </span>
                        <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                            {t('heading')}
                        </h2>
                        <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
                            {t('description')}
                        </p>
                        <p className="text-muted-foreground mt-6 max-w-xl leading-relaxed">
                            {t('price_note')}
                        </p>
                    </div>

                    <div className="border-foreground bg-card rounded-lg border-2 p-6 md:p-8">
                        <p className="text-4xl font-bold">{t('price')}</p>

                        <p className="text-muted-foreground mt-8 mb-4 text-sm font-medium tracking-wide uppercase">
                            {t('includes_label')}
                        </p>
                        <ul className="space-y-3">
                            {includeKeys.map((key) => (
                                <li
                                    key={key}
                                    className="flex items-start gap-3"
                                >
                                    <Check className="text-foreground mt-0.5 size-5 shrink-0" />
                                    <span className="text-foreground">
                                        {t(key)}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <StartBriefButton
                            variant="filled"
                            size="lg"
                            className="mt-8 w-full justify-center font-semibold"
                        >
                            {t('cta')}
                        </StartBriefButton>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PricingSection;
