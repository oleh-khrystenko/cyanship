import { resolve } from 'path';
import { config } from 'dotenv';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Load .env from monorepo root — single source of truth for all env vars.
config({ path: resolve(__dirname, '../../.env') });

// Reverse proxy: all /api requests are forwarded to the backend.
// This keeps API and Web on the same origin, so cookies (bid_refresh)
// are set on the web domain and visible to middleware.
const apiInternalUrl = process.env.API_INTERNAL_URL;
if (!apiInternalUrl) {
    throw new Error('❌ Environment variable "API_INTERNAL_URL" is not defined');
}

const nextConfig: NextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
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
