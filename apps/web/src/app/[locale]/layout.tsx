import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Mulish } from 'next/font/google';
import '@/app/globals.css';
import { IPageParams } from '@/shared/types/settings';
import ThemeProvider from '@/providers/ThemeProvider';

const mulish = Mulish({
    subsets: ['cyrillic', 'latin'],
    weight: ['300', '400', '700'],
});

interface ILocaleLayoutProps extends IPageParams {
    children: ReactNode;
}

export default async function LocaleLayout({
    children,
    params,
}: ILocaleLayoutProps) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
            </head>

            <body className={`${mulish.className} bg-onyx text-snow`}>
                <NextIntlClientProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        {children}
                    </ThemeProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
