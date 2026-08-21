import { useTranslations } from 'next-intl';
import { Globe, LineChart, Bot, LucideIcon } from 'lucide-react';

const steps: { key: number; icon: LucideIcon }[] = [
    { key: 1, icon: Globe },
    { key: 2, icon: LineChart },
    { key: 3, icon: Bot },
];

/**
 * Deliberately priced nowhere. Support and the assistant have never been sold
 * at a fixed number, and a figure invented for a landing page is the one thing
 * on this site that could not be honoured.
 */
const LadderSection = () => {
    const t = useTranslations('home_page.ladder');

    return (
        <section className="border-border border-t py-24">
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

                <div className="mt-16 grid gap-4 md:grid-cols-3 md:gap-6">
                    {steps.map(({ key, icon: Icon }) => (
                        <div
                            key={key}
                            className="border-border bg-card rounded-lg border p-6"
                        >
                            <div className="border-border bg-secondary flex size-12 items-center justify-center rounded-lg border">
                                <Icon className="text-foreground size-6" />
                            </div>
                            <h3 className="mt-5 text-lg font-semibold">
                                {t(`step_${key}_title`)}
                            </h3>
                            <p className="text-muted-foreground mt-2 leading-relaxed">
                                {t(`step_${key}_description`)}
                            </p>
                        </div>
                    ))}
                </div>

                <p className="text-muted-foreground mt-8 max-w-2xl text-sm leading-relaxed">
                    {t('note')}
                </p>
            </div>
        </section>
    );
};

export default LadderSection;
