// ============================================================
// FAIL FAST POLICY:
// NEVER add fallback values for URLs, secrets, or API keys.
// If a variable is missing, crash immediately.
// Silent failures with localhost fallbacks are invisible in
// production and break SEO (canonical URLs, Open Graph), auth,
// and API connectivity.
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
} as const;

// Payment type toggles (sync with backend PAYMENTS_*_ENABLED)
// Set to 'false' to hide payment UI sections
export const PAYMENTS_SUBSCRIPTION_ENABLED =
    process.env.NEXT_PUBLIC_PAYMENTS_SUBSCRIPTION_ENABLED !== 'false';

export const PAYMENTS_ONE_OFF_ENABLED =
    process.env.NEXT_PUBLIC_PAYMENTS_ONE_OFF_ENABLED !== 'false';
