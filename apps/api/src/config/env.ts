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
import type { CreditPackCode } from '@lucidkit/types';

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

// Compute payment toggles early — credit price env vars are only required when one-off is enabled.
const oneOffEnabled =
    getEnvVar('PAYMENTS_ONE_OFF_ENABLED', 'true') === 'true';

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

    // --- STRIPE (required — crash if missing) ---
    STRIPE_SECRET_KEY: getEnvVar('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: getEnvVar('STRIPE_WEBHOOK_SECRET'),
    STRIPE_PRICE_MONTHLY_USD: getEnvVar('STRIPE_PRICE_MONTHLY_USD'),

    // --- STRIPE Credit Pack Prices ---
    // Required only when PAYMENTS_ONE_OFF_ENABLED=true.
    // Create as one-time prices in Stripe Dashboard (mode: Payment, not Subscription)
    STRIPE_PRICE_CREDITS_5_USD: oneOffEnabled
        ? getEnvVar('STRIPE_PRICE_CREDITS_5_USD')
        : getEnvVar('STRIPE_PRICE_CREDITS_5_USD', ''),
    STRIPE_PRICE_CREDITS_10_USD: oneOffEnabled
        ? getEnvVar('STRIPE_PRICE_CREDITS_10_USD')
        : getEnvVar('STRIPE_PRICE_CREDITS_10_USD', ''),
    STRIPE_PRICE_CREDITS_20_USD: oneOffEnabled
        ? getEnvVar('STRIPE_PRICE_CREDITS_20_USD')
        : getEnvVar('STRIPE_PRICE_CREDITS_20_USD', ''),

    // Billing URLs — optional (defaults based on WEB_URL)
    BILLING_SUCCESS_URL: getEnvVar(
        'BILLING_SUCCESS_URL',
        `${getEnvVar('WEB_URL', 'http://localhost:3000')}/billing/success`
    ),
    BILLING_CANCEL_URL: getEnvVar(
        'BILLING_CANCEL_URL',
        `${getEnvVar('WEB_URL', 'http://localhost:3000')}/billing/cancel`
    ),

    // --- PAYMENT TYPE TOGGLES ---
    // Set to 'false' to disable a payment type entirely.
    // At least one must be 'true'.
    PAYMENTS_SUBSCRIPTION_ENABLED:
        getEnvVar('PAYMENTS_SUBSCRIPTION_ENABLED', 'true') === 'true',
    PAYMENTS_ONE_OFF_ENABLED: oneOffEnabled,

    // --- AUTH CONFIGURATION (optional, with defaults) ---
    AUTH_PASSWORD_MIN_LENGTH: parseInt(
        getEnvVar('AUTH_PASSWORD_MIN_LENGTH', '8'),
        10
    ),
    AUTH_LOCKOUT_THRESHOLDS: getEnvVar(
        'AUTH_LOCKOUT_THRESHOLDS',
        '5:1,10:5,20:15'
    ),
    AUTH_LOGIN_ATTEMPTS_TTL_MIN: parseInt(
        getEnvVar('AUTH_LOGIN_ATTEMPTS_TTL_MIN', '15'),
        10
    ),
    AUTH_MAGIC_LINK_TTL_MIN: parseInt(
        getEnvVar('AUTH_MAGIC_LINK_TTL_MIN', '15'),
        10
    ),
    AUTH_MAGIC_LINK_RATE_LIMIT: parseInt(
        getEnvVar('AUTH_MAGIC_LINK_RATE_LIMIT', '3'),
        10
    ),
    AUTH_MAGIC_LINK_RATE_WINDOW_MIN: parseInt(
        getEnvVar('AUTH_MAGIC_LINK_RATE_WINDOW_MIN', '15'),
        10
    ),
    AUTH_MAGIC_LINK_DEDUP_SEC: parseInt(
        getEnvVar('AUTH_MAGIC_LINK_DEDUP_SEC', '60'),
        10
    ),
    ACCOUNT_DELETION_GRACE_DAYS: parseInt(
        getEnvVar('ACCOUNT_DELETION_GRACE_DAYS', '30'),
        10
    ),
};

// Validate payment toggles
if (!ENV.PAYMENTS_SUBSCRIPTION_ENABLED && !ENV.PAYMENTS_ONE_OFF_ENABLED) {
    throw new Error(
        '❌ At least one payment type must be enabled. ' +
            'Set PAYMENTS_SUBSCRIPTION_ENABLED or PAYMENTS_ONE_OFF_ENABLED to "true".'
    );
}

// Computed: maps packCode → { priceId, credits }
// Used in PaymentsService to resolve priceId for one-off checkouts.
// Empty when one-off payments are disabled — prevents sending empty priceId to Stripe.
export const STRIPE_CREDIT_PACKS: Partial<
    Record<CreditPackCode, { priceId: string; credits: number }>
> = oneOffEnabled
    ? {
          credits_5: {
              priceId: ENV.STRIPE_PRICE_CREDITS_5_USD,
              credits: 5,
          },
          credits_10: {
              priceId: ENV.STRIPE_PRICE_CREDITS_10_USD,
              credits: 10,
          },
          credits_20: {
              priceId: ENV.STRIPE_PRICE_CREDITS_20_USD,
              credits: 20,
          },
      }
    : {};

// Парсинг AUTH_LOCKOUT_THRESHOLDS="5:1,10:5,20:15" → [{ attempts: 5, blockMin: 1 }, ...]
export function parseLockoutThresholds(
    raw: string
): Array<{ attempts: number; blockMin: number }> {
    return raw.split(',').map((entry) => {
        const [attempts, blockMin] = entry.split(':').map(Number);
        return { attempts, blockMin };
    });
}
