// ============================================================
// FAIL FAST POLICY:
// NEVER add fallback values for URLs, secrets, API keys, or
// connection strings. If a variable is missing, crash immediately.
// Silent failures with localhost fallbacks are invisible in
// production and break auth, SEO, storage, payments.
// Only NODE_ENV, PORT, MONGODB_DB_NAME, WEB_URL may have defaults.
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
    MONGODB_DB_NAME: getEnvVar('MONGODB_DB_NAME', 'lucidkit'),
    WEB_URL: getEnvVar('WEB_URL', 'http://localhost:3000'),

    // --- REQUIRED (no fallback — crash if missing) ---
    MONGODB_URI: getEnvVar('MONGODB_URI'),
    JWT_ACCESS_SECRET: getEnvVar('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: getEnvVar('JWT_REFRESH_SECRET'),
    REDIS_URL: getEnvVar('REDIS_URL'),

    // Cloudflare R2
    R2_ACCOUNT_ID: getEnvVar('R2_ACCOUNT_ID'),
    R2_BUCKET_NAME: getEnvVar('R2_BUCKET_NAME'),
    R2_ACCESS_KEY_ID: getEnvVar('R2_ACCESS_KEY_ID'),
    R2_SECRET_ACCESS_KEY: getEnvVar('R2_SECRET_ACCESS_KEY'),
    R2_ENDPOINT: getEnvVar('R2_ENDPOINT'),
    R2_PUBLIC_URL: getEnvVar('R2_PUBLIC_URL'),

    // Google OAuth
    GOOGLE_CLIENT_ID: getEnvVar('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: getEnvVar('GOOGLE_CLIENT_SECRET'),
    GOOGLE_CALLBACK_URL: getEnvVar('GOOGLE_CALLBACK_URL'),

    // Google AI (Gemini)
    GOOGLE_GEMINI_API_KEY: getEnvVar('GOOGLE_GEMINI_API_KEY'),

    // Resend (email)
    RESEND_API_KEY: getEnvVar('RESEND_API_KEY'),
    // Production: MUST set real sender (verified domain). Dev: uses Resend test sender.
    RESEND_FROM_EMAIL: isProduction
        ? getEnvVar('RESEND_FROM_EMAIL')
        : getEnvVar('RESEND_FROM_EMAIL', 'LucidKit <onboarding@resend.dev>'),
};
