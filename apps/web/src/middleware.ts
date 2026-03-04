import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED_PATHS = ['/profile', '/pay', '/billing'];
const AUTH_PATHS = ['/auth/signin'];
const COOKIE_NAME = 'bid_refresh';

const localePattern = new RegExp(`^/(${routing.locales.join('|')})(/.*)?$`);

function stripLocale(pathname: string): string {
    const match = pathname.match(localePattern);
    return match?.[2] || '/';
}

export default function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const path = stripLocale(pathname);
    const hasRefreshCookie = request.cookies.has(COOKIE_NAME);
    const locale = pathname.match(localePattern)?.[1] || routing.defaultLocale;

    const isProtected = PROTECTED_PATHS.some(
        (p) => path === p || path.startsWith(`${p}/`)
    );

    if (isProtected && !hasRefreshCookie) {
        return NextResponse.redirect(
            new URL(`/${locale}/auth/signin`, request.url)
        );
    }

    return intlMiddleware(request);
}

export const config = {
    matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
