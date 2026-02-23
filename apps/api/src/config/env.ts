// ============================================================
// FAIL FAST POLICY:
// NEVER add fallback values for URLs, secrets, API keys, or
// connection strings. If a variable is missing, crash immediately.
// Silent failures with localhost fallbacks are invisible in
// production and break auth and SEO.
// Only NODE_ENV, PORT, WEB_URL may have defaults.
// ============================================================

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from monorepo root before reading process.env.
// Use __dirname (relative to this file) instead of process.cwd() which varies by runner.
// In Docker, env vars are set via `environment:` — dotenv silently skips if file not found.
config({ path: resolve(__dirname, '../../../../.env') });

const getEnvVar = (name: string, fallback?: string): string => {
    const value = process.env[name];
    if (!value && fallback === undefined) {
        throw new Error(`❌ Environment variable "${name}" is not defined`);
    }
    return value ?? fallback!;
};

const nodeEnv = getEnvVar('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

export const ENV = {
    // --- REQUIRED WITH DEFAULTS ---
    NODE_ENV: nodeEnv,
    PORT: getEnvVar('PORT', '4000'),
    WEB_URL: getEnvVar('WEB_URL', 'http://localhost:3000'),

    // --- REQUIRED (no fallback — crash if missing) ---
    MONGODB_URI: getEnvVar('MONGODB_URI'),
    JWT_ACCESS_SECRET: getEnvVar('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: getEnvVar('JWT_REFRESH_SECRET'),
    REDIS_URL: getEnvVar('REDIS_URL'),

    // Google OAuth
    GOOGLE_CLIENT_ID: getEnvVar('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: getEnvVar('GOOGLE_CLIENT_SECRET'),
    GOOGLE_CALLBACK_URL: getEnvVar('GOOGLE_CALLBACK_URL'),

    // Resend (email)
    RESEND_API_KEY: getEnvVar('RESEND_API_KEY'),
    // Production: MUST set real sender (verified domain). Dev: uses Resend test sender.
    RESEND_FROM_EMAIL: isProduction
        ? getEnvVar('RESEND_FROM_EMAIL')
        : getEnvVar('RESEND_FROM_EMAIL', 'LucidKit <onboarding@resend.dev>'),
};
