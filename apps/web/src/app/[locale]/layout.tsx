import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Mulish } from 'next/font/google';
import '@/app/globals.css';
import { PageParams } from '@/shared/types/settings';
import { Header } from '@/widgets/header';
import { AuthInitializer } from '@/features/auth';
import { Providers } from '@/app/providers';

const mulish = Mulish({
    subsets: ['cyrillic', 'latin'],
    weight: ['300', '400', '700'],
});

interface LocaleLayoutProps extends PageParams {
    children: ReactNode;
}

export default async function LocaleLayout({
    children,
    params,
}: LocaleLayoutProps) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <meta name="darkreader-lock" />
                <meta name="color-scheme" content="light dark" />
                <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
            </head>

            <body
                className={`${mulish.className} bg-background text-text-primary`}
            >
                <Providers>
                    <NextIntlClientProvider>
                        <AuthInitializer />
                        <Header />
                        {children}
                    </NextIntlClientProvider>
                </Providers>
            </body>
        </html>
    );
}
