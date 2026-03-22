// ============================================================
// FAIL FAST POLICY:
// Every env var is required. No fallbacks. No defaults in code.
// If a variable is missing, crash immediately.
// All values live in .env (dev) or environment config (prod).
// ============================================================

import { config } from 'dotenv';
import { resolve } from 'path';
import {
    SUBSCRIPTION_PLANS,
    EXECUTION_PACKS,
    type SubscriptionPlanCode,
    type ExecutionPackCode,
} from '@cyanship/types';

// Load .env from monorepo root before reading process.env.
// Use __dirname (relative to this file) instead of process.cwd() which varies by runner.
// In Docker, env vars are set via `environment:` — dotenv silently skips if file not found.
config({ path: resolve(__dirname, '../../../../.env') });

const getEnvVar = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`❌ Environment variable "${name}" is not defined`);
    }
    return value;
};

const subscriptionEnabled =
    getEnvVar('PAYMENTS_SUBSCRIPTION_ENABLED') === 'true';
const oneOffEnabled = getEnvVar('PAYMENTS_ONE_OFF_ENABLED') === 'true';

export const ENV = {
    NODE_ENV: getEnvVar('NODE_ENV'),
    PORT: getEnvVar('PORT'),
    WEB_URL: getEnvVar('WEB_URL'),

    MONGODB_URI: getEnvVar('MONGODB_URI'),
    JWT_ACCESS_SECRET: getEnvVar('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: getEnvVar('JWT_REFRESH_SECRET'),
    REDIS_URL: getEnvVar('REDIS_URL'),

    GOOGLE_CLIENT_ID: getEnvVar('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: getEnvVar('GOOGLE_CLIENT_SECRET'),
    GOOGLE_CALLBACK_URL: getEnvVar('GOOGLE_CALLBACK_URL'),

    RESEND_API_KEY: getEnvVar('RESEND_API_KEY'),
    RESEND_FROM_EMAIL: getEnvVar('RESEND_FROM_EMAIL'),

    STRIPE_SECRET_KEY: getEnvVar('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: getEnvVar('STRIPE_WEBHOOK_SECRET'),

    PAYMENTS_SUBSCRIPTION_ENABLED: subscriptionEnabled,
    PAYMENTS_ONE_OFF_ENABLED: oneOffEnabled,

    AUTH_PASSWORD_MIN_LENGTH: parseInt(
        getEnvVar('AUTH_PASSWORD_MIN_LENGTH'),
        10
    ),
    AUTH_LOCKOUT_THRESHOLDS: getEnvVar('AUTH_LOCKOUT_THRESHOLDS'),
    AUTH_LOGIN_ATTEMPTS_TTL_MIN: parseInt(
        getEnvVar('AUTH_LOGIN_ATTEMPTS_TTL_MIN'),
        10
    ),
    AUTH_MAGIC_LINK_TTL_MIN: parseInt(getEnvVar('AUTH_MAGIC_LINK_TTL_MIN'), 10),
    AUTH_MAGIC_LINK_RATE_LIMIT: parseInt(
        getEnvVar('AUTH_MAGIC_LINK_RATE_LIMIT'),
        10
    ),
    AUTH_MAGIC_LINK_RATE_WINDOW_MIN: parseInt(
        getEnvVar('AUTH_MAGIC_LINK_RATE_WINDOW_MIN'),
        10
    ),
    AUTH_MAGIC_LINK_DEDUP_SEC: parseInt(
        getEnvVar('AUTH_MAGIC_LINK_DEDUP_SEC'),
        10
    ),
    ACCOUNT_DELETION_GRACE_DAYS: parseInt(
        getEnvVar('ACCOUNT_DELETION_GRACE_DAYS'),
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

// Dynamic: one env var per subscription plan, fail-fast when subscriptions enabled
export const STRIPE_SUBSCRIPTION_PLANS: Partial<
    Record<SubscriptionPlanCode, { priceId: string; executions: number }>
> = (() => {
    if (!subscriptionEnabled) return {};
    const result: Record<string, { priceId: string; executions: number }> = {};
    for (const plan of SUBSCRIPTION_PLANS) {
        const envName = `STRIPE_PRICE_ID_SUB_${plan.code.toUpperCase()}`;
        result[plan.code] = {
            priceId: getEnvVar(envName),
            executions: plan.executions,
        };
    }
    return result;
})();

// Reverse lookup: Stripe priceId → plan code (for webhook plan-switch detection)
export const STRIPE_PRICE_TO_PLAN: Record<string, string> = (() => {
    const result: Record<string, string> = {};
    for (const [code, entry] of Object.entries(STRIPE_SUBSCRIPTION_PLANS)) {
        if (entry) result[entry.priceId] = code;
    }
    return result;
})();

// Dynamic: one env var per execution pack, fail-fast when one-off enabled
export const STRIPE_EXECUTION_PACKS: Partial<
    Record<ExecutionPackCode, { priceId: string; executions: number }>
> = (() => {
    if (!oneOffEnabled) return {};
    const result: Record<string, { priceId: string; executions: number }> = {};
    for (const pack of EXECUTION_PACKS) {
        const envName = `STRIPE_PRICE_ID_ONEOFF_${pack.code.toUpperCase()}`;
        result[pack.code] = {
            priceId: getEnvVar(envName),
            executions: pack.executions,
        };
    }
    return result;
})();

// Парсинг AUTH_LOCKOUT_THRESHOLDS="5:1,10:5,20:15" → [{ attempts: 5, blockMin: 1 }, ...]
export function parseLockoutThresholds(
    raw: string
): Array<{ attempts: number; blockMin: number }> {
    return raw.split(',').map((entry) => {
        const [attempts, blockMin] = entry.split(':').map(Number);
        return { attempts, blockMin };
    });
}
