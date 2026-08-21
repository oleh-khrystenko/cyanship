import { useLocale, useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { Logo } from '@/entities/brand';
import { GitHubIcon, LinkedInIcon } from '@/shared/icons';
import UiLink from '@/shared/ui/UiLink';
import type { SectionAnchors } from '@/features/agency/landing-nav';
import CopyrightLine from './CopyrightLine';
import FooterNavLinks from './FooterNavLinks';

const legalLinks = [
    { key: 'terms', href: '/terms' },
    { key: 'privacy', href: '/privacy' },
] as const;

const socialLinks = [
    {
        key: 'linkedin',
        href: 'https://www.linkedin.com/in/oleh-khrystenko',
        icon: LinkedInIcon,
    },
    {
        key: 'github',
        href: 'https://github.com/oleh-khrystenko',
        icon: GitHubIcon,
    },
] as const;

interface SiteFooterProps {
    /**
     * Which anchor each section carries on the page rendering this footer.
     * Passed by the page, because the page is the only thing that knows what it
     * renders: the product column scrolls to a section that is here and travels
     * to the home page for one that is not. Omitted on the legal pages, which
     * have no sections at all.
     */
    sectionAnchors?: SectionAnchors;
}

const SiteFooter = ({ sectionAnchors = {} }: SiteFooterProps) => {
    const t = useTranslations('site_footer');
    const tBrand = useTranslations('brand');
    const locale = useLocale();

    return (
        <footer className="border-border bg-card border-t">
            <div className="container px-6">
                {/* Top: Logo + slogan + columns */}
                <div className="grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-12">
                    {/* Brand */}
                    <div className="lg:col-span-5">
                        <Logo />
                        <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
                            {tBrand('slogan')}
                        </p>
                    </div>

                    {/* 3 columns */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:col-span-7 lg:grid-cols-3">
                        {/* Product */}
                        <div>
                            <h4 className="text-foreground text-sm font-semibold tracking-wider uppercase">
                                {t('col_product')}
                            </h4>
                            <FooterNavLinks sectionAnchors={sectionAnchors} />
                        </div>

                        {/* Legal */}
                        <div>
                            <h4 className="text-foreground text-sm font-semibold tracking-wider uppercase">
                                {t('col_legal')}
                            </h4>
                            <ul className="mt-1 space-y-0.5">
                                {legalLinks.map(({ key, href }) => (
                                    <li key={key}>
                                        {/* Carries the locale and travels through
                                            the app's own navigation, like the
                                            product column beside it: a bare
                                            `/terms` would reload the page and
                                            leave the middleware to guess the
                                            language again from a cookie.

                                            `min-h-11` is the 44px tap floor —
                                            see the note in `FooterNavLinks`. */}
                                        <UiLink
                                            as="link"
                                            href={`/${locale}${href}`}
                                            variant="muted"
                                            className="inline-flex min-h-11 items-center text-sm"
                                        >
                                            {t(`legal_${key}`)}
                                        </UiLink>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Connect */}
                        <div className="col-span-2 sm:col-span-1">
                            <h4 className="text-foreground text-sm font-semibold tracking-wider uppercase">
                                {t('col_connect')}
                            </h4>
                            <UiLink
                                href="mailto:oleg@cyanship.com"
                                variant="muted"
                                className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm"
                            >
                                <Mail className="size-3.5" />
                                {t('email')}
                            </UiLink>
                            {/* The icons stay 16px; the box around them grows to
                                44×44 so a thumb has something to land on. The row
                                gap shrinks to compensate — the icons keep the
                                spacing they looked right at. */}
                            <div className="-ml-3.5 flex items-center">
                                {socialLinks.map(
                                    ({ key, href, icon: Icon }) => (
                                        <UiLink
                                            key={key}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={t(`social_${key}`)}
                                            variant="muted"
                                            className="inline-flex min-h-11 min-w-11 items-center justify-center"
                                        >
                                            <Icon className="size-4" />
                                        </UiLink>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-border border-t py-8">
                    <CopyrightLine prerenderedYear={new Date().getFullYear()} />
                </div>
            </div>
        </footer>
    );
};

export default SiteFooter;
