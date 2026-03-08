import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';

const stepKeys = ['step_1', 'step_2', 'step_3'] as const;

const DogfoodingSection = () => {
    const t = useTranslations('landing_page.dogfooding');

    return (
        <section className="border-t border-border py-24">
            <div className="container px-6">
                <div className="max-w-2xl">
                    <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                        {t('heading')}
                    </h2>
                    <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                        {t('description')}
                    </p>
                </div>

                <ul className="mt-12 max-w-xl space-y-4">
                    {stepKeys.map((key) => (
                        <li
                            key={key}
                            className="flex items-start gap-4 rounded-lg border border-border bg-card p-4"
                        >
                            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground">
                                <Check className="size-4 text-background" />
                            </div>
                            <span className="text-foreground">
                                {t(key)}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
};

export default DogfoodingSection;
