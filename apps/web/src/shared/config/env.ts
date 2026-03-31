// ============================================================
// FAIL FAST POLICY:
// Every env var is required. No fallbacks. No defaults in code.
// If a variable is missing, crash immediately.
//
// IMPORTANT: NEXT_PUBLIC_* vars MUST use direct process.env.VAR
// access (not dynamic process.env[name]) so Next.js can inline
// values into the client bundle at build time.
// ============================================================

function assertEnv(value: string | undefined, name: string): string {
    if (!value) {
        throw new Error(`❌ Environment variable "${name}" is not defined`);
    }
    return value;
}

export const ENV = {
    NEXT_PUBLIC_BASE_URL: assertEnv(
        process.env.NEXT_PUBLIC_BASE_URL,
        'NEXT_PUBLIC_BASE_URL'
    ),
    NEXT_PUBLIC_API_URL: assertEnv(
        process.env.NEXT_PUBLIC_API_URL,
        'NEXT_PUBLIC_API_URL'
    ),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: assertEnv(
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        'NEXT_PUBLIC_TURNSTILE_SITE_KEY'
    ),
} as const;

export const PAYMENTS_SUBSCRIPTION_ENABLED =
    assertEnv(
        process.env.NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED,
        'NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED'
    ) === 'true';

export const PAYMENTS_ONE_OFF_ENABLED =
    assertEnv(
        process.env.NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED,
        'NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED'
    ) === 'true';

export const DEMO_VIDEO_ENABLED =
    !!process.env.NEXT_PUBLIC_CF_STREAM_CUSTOMER_CODE &&
    !!process.env.NEXT_PUBLIC_CF_STREAM_VIDEO_ID;
