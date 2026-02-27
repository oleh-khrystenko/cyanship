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
