import { resolve } from 'path';
import { config } from 'dotenv';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Load .env from monorepo root — single source of truth for all env vars.
config({ path: resolve(__dirname, '../../.env') });

// Reverse proxy: all /api requests are forwarded to the backend.
// This keeps API and Web on the same origin, so cookies (bid_refresh)
// are set on the web domain and visible to middleware.
// Default: http://localhost:4000 for local dev.
// Docker/prod: override via API_INTERNAL_URL env var.
const apiInternalUrl = process.env.API_INTERNAL_URL || 'http://localhost:4000';

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
