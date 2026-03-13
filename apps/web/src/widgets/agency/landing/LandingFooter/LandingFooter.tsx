import { useTranslations } from 'next-intl';
import { Linkedin, Twitter, ExternalLink, Mail } from 'lucide-react';
import { Logo } from '@/entities/brand';

const navLinks = [
    { key: 'pricing', href: '#pricing' },
    { key: 'portfolio', href: '#portfolio' },
    { key: 'workflow', href: '#workflow' },
] as const;

const legalLinks = [
    { key: 'terms', href: '/terms' },
    { key: 'privacy', href: '/privacy' },
] as const;

const socialLinks = [
    {
        key: 'linkedin',
        href: 'https://www.linkedin.com/in/oleg-khrystenko/',
        icon: Linkedin,
    },
    {
        key: 'twitter',
        href: 'https://x.com/kh_oleg_',
        icon: Twitter,
    },
] as const;

const LandingFooter = () => {
    const t = useTranslations('landing_page.footer');

    return (
        <footer className="border-t border-border bg-card py-16">
            <div className="container px-6">
                {/* Top: Logo + slogan + columns */}
                <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12">
                    {/* Brand */}
                    <div className="lg:col-span-5">
                        <Logo />
                        <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                            {t('slogan')}
                        </p>
                    </div>

                    {/* 3 columns */}
                    <div className="grid grid-cols-3 gap-8 lg:col-span-7">
                        {/* Product */}
                        <div>
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                                {t('col_product')}
                            </h4>
                            <ul className="mt-4 space-y-3">
                                {navLinks.map(({ key, href }) => (
                                    <li key={key}>
                                        <a
                                            href={href}
                                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            {t(`nav_${key}`)}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Legal */}
                        <div>
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                                {t('col_legal')}
                            </h4>
                            <ul className="mt-4 space-y-3">
                                {legalLinks.map(({ key, href }) => (
                                    <li key={key}>
                                        <a
                                            href={href}
                                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            {t(`legal_${key}`)}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Connect */}
                        <div>
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                                {t('col_connect')}
                            </h4>
                            <ul className="mt-4 space-y-3">
                                <li>
                                    <a
                                        href="mailto:oleg@lucidship.dev"
                                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        <Mail className="size-3.5" />
                                        {t('email')}
                                    </a>
                                </li>
                                {socialLinks.map(
                                    ({ key, href, icon: Icon }) => (
                                        <li key={key}>
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                <Icon className="size-3.5" />
                                                {t(`social_${key}`)}
                                                <ExternalLink className="size-3" />
                                            </a>
                                        </li>
                                    )
                                )}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="mt-12 border-t border-border pt-8">
                    <p className="text-center text-sm text-muted-foreground">
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
