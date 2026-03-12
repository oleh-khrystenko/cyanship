import { useTranslations } from 'next-intl';
import { Logo } from '@/entities/brand';

const LandingFooter = () => {
    const t = useTranslations('landing_page.footer');

    return (
        <footer className="border-t border-border py-8">
            <div className="container px-6">
                <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
                    <Logo />
                    <p className="text-sm text-muted-foreground">
                        {t('copyright', {
                            year: new Date().getFullYear(),
                        })}
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default LandingFooter;
