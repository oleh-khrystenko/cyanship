import { resolve } from 'path';
import { config } from 'dotenv';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Load .env from monorepo root — single source of truth for all env vars.
config({ path: resolve(__dirname, '../../.env') });

// `next.config.ts` runs in the Node build context, outside the client env
// module, so it reads process.env directly. A missing value is a deployment
// bug — fail the build instead of degrading silently at render time.
function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`❌ Environment variable "${name}" is not defined`);
    }
    return value;
}

function parseAbsoluteUrl(value: string, name: string): URL {
    try {
        return new URL(value);
    } catch {
        throw new Error(
            `❌ Environment variable "${name}" must be a valid absolute URL`
        );
    }
}

// Requires an http(s) origin with no path and no trailing slash, so the value
// stays safe to concatenate paths onto.
function requireOrigin(name: string): URL {
    const value = requireEnv(name);
    const url = parseAbsoluteUrl(value, name);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(
            `❌ Environment variable "${name}" must use http or https`
        );
    }

    if (value !== url.origin) {
        throw new Error(
            `❌ Environment variable "${name}" must be an origin only ` +
                `(protocol + host), without a path or trailing slash — got "${value}"`
        );
    }

    return url;
}

// Reverse proxy: all /api requests are forwarded to the backend.
// This keeps API and Web on the same origin, so cookies (bid_refresh)
// are set on the web domain and visible to middleware.
//
// Required, not optional: the browser only ever talks to `API_BASE_PATH`
// (`/api` on the web origin), so without this rewrite every API call — sign-in,
// billing, chat — resolves to a Next 404. A missing value must fail the build,
// not ship a silently dead frontend.
const apiInternalUrl = requireOrigin('API_INTERNAL_URL').origin;

// `WEB_URL` and `R2_PUBLIC_URL` belong to the API side of `.env`, but the
// browser needs both values. Instead of a second copy under NEXT_PUBLIC_
// names they are inlined into the bundle here (`env` below) — one value in
// `.env`, no invariant to keep in sync between the two apps.
//
// Both are consumed by plain concatenation on both sides
// (`${WEB_URL}/${locale}`, `${R2_PUBLIC_URL}/${key}`), so both must be an
// origin only. A trailing slash or a path segment would silently produce `//`
// in canonical URLs, email links, Stripe return URLs and media URLs — rejected
// here instead of shipping broken links.
const webUrl = requireOrigin('WEB_URL').origin;

const storage = requireOrigin('R2_PUBLIC_URL');
const storageUrl = storage.origin;
const storageProtocol = storage.protocol === 'https:' ? 'https' : 'http';

const nextConfig: NextConfig = {
    output: 'standalone',
    compress: false,
    reactStrictMode: true,
    env: {
        NEXT_PUBLIC_BASE_URL: webUrl,
        NEXT_PUBLIC_STORAGE_URL: storageUrl,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
            {
                protocol: storageProtocol,
                hostname: storage.hostname,
            },
        ],
    },
    rewrites: async () => [
        {
            source: '/api/:path*',
            destination: `${apiInternalUrl}/api/:path*`,
        },
    ],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
