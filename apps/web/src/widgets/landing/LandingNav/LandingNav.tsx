import { useTranslations } from 'next-intl';

const navItems = [
    { key: 'approach', href: '#problem' },
    { key: 'portfolio', href: '#portfolio' },
    { key: 'workflow', href: '#workflow' },
    { key: 'pricing', href: '#pricing' },
] as const;

const LandingNav = () => {
    const t = useTranslations('landing_page.nav');

    return (
        <nav className="border-b border-border">
            <div className="container px-6">
                <div className="flex gap-2 overflow-x-auto py-3 md:justify-center md:gap-8">
                    {navItems.map(({ key, href }) => (
                        <a
                            key={key}
                            href={href}
                            className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {t(key)}
                        </a>
                    ))}
                </div>
            </div>
        </nav>
    );
};

export default LandingNav;
