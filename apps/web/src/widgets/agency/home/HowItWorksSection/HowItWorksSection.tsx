import { useTranslations } from 'next-intl';
import {
    Link2,
    LayoutTemplate,
    Tag,
    CheckCircle2,
    LucideIcon,
} from 'lucide-react';

const steps: { key: number; icon: LucideIcon; primary?: boolean }[] = [
    { key: 1, icon: Link2, primary: true },
    { key: 2, icon: LayoutTemplate },
    { key: 3, icon: Tag },
    { key: 4, icon: CheckCircle2 },
];

const HowItWorksSection = () => {
    const t = useTranslations('home_page.how_it_works');

    return (
        <section
            id="process"
            className="border-border scroll-mt-16 border-t py-24"
        >
            <div className="container px-6">
                <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
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
                    </div>

                    <div className="flex justify-center lg:justify-end">
                        <div className="w-full max-w-md space-y-3">
                            {steps.map(({ key, icon: Icon, primary }) => (
                                <div
                                    key={key}
                                    className="border-border bg-card relative flex items-center gap-4 rounded-xl border p-4"
                                >
                                    <div
                                        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                                            primary
                                                ? 'bg-primary'
                                                : 'border-border bg-secondary border'
                                        }`}
                                    >
                                        <Icon
                                            className={`size-4 ${
                                                primary
                                                    ? 'text-primary-foreground'
                                                    : 'text-muted-foreground'
                                            }`}
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-foreground text-sm font-medium">
                                            {t(`step_${key}_title`)}
                                        </p>
                                        <p className="text-muted-foreground text-sm">
                                            {t(`step_${key}_sub`)}
                                        </p>
                                    </div>
                                    <span className="text-muted-foreground/60 font-mono text-xs">
                                        {String(key).padStart(2, '0')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HowItWorksSection;
