import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Mulish } from 'next/font/google';
import '@/app/globals.css';
import { IPageParams } from '@/shared/types/settings';

const setInitialTheme = `
    (function() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            document.documentElement.classList.add(savedTheme);
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const defaultTheme = prefersDark ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', defaultTheme);
            document.documentElement.classList.add(defaultTheme);
        }
    })();
`;

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
        <html lang={locale}>
            <head>
                <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
                <script dangerouslySetInnerHTML={{ __html: setInitialTheme }} />
            </head>

            <body className={`${mulish.className} bg-onyx text-snow`}>
                <NextIntlClientProvider>{children}</NextIntlClientProvider>
            </body>
        </html>
    );
}
