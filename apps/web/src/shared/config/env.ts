// ============================================================
// FAIL FAST POLICY:
// Every env var is required. No fallbacks. No defaults in code.
// If a variable is missing, crash immediately.
//
// IMPORTANT: NEXT_PUBLIC_* vars MUST use direct process.env.VAR
// access (not dynamic process.env[name]) so Next.js can inline
// values into the client bundle at build time.
//
// NEXT_PUBLIC_BASE_URL and NEXT_PUBLIC_STORAGE_URL are absent from
// `.env` on purpose: `next.config.ts` inlines them from WEB_URL and
// R2_PUBLIC_URL, which the API already owns.
// ============================================================

function assertEnv(value: string | undefined, name: string): string {
    if (!value) {
        throw new Error(`❌ Environment variable "${name}" is not defined`);
    }
    return value;
}

const STORAGE_URL = assertEnv(
    process.env.NEXT_PUBLIC_STORAGE_URL,
    'NEXT_PUBLIC_STORAGE_URL'
);

/**
 * Builds an absolute media URL from a path relative to the storage bucket.
 * `NEXT_PUBLIC_STORAGE_URL` is an origin without a trailing slash —
 * `next.config.ts` fails the build otherwise.
 */
function resolveOptionalStorageAsset(
    path: string | undefined,
    name: string
): string | null {
    if (!path) {
        return null;
    }

    if (!path.startsWith('/')) {
        throw new Error(
            `❌ Environment variable "${name}" must be a path starting with "/"`
        );
    }

    return `${STORAGE_URL}${path}`;
}

export const ENV = {
    NEXT_PUBLIC_BASE_URL: assertEnv(
        process.env.NEXT_PUBLIC_BASE_URL,
        'NEXT_PUBLIC_BASE_URL'
    ),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: assertEnv(
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
        'NEXT_PUBLIC_TURNSTILE_SITE_KEY'
    ),
} as const;

const demoVideoSrc = resolveOptionalStorageAsset(
    process.env.NEXT_PUBLIC_DEMO_VIDEO_PATH,
    'NEXT_PUBLIC_DEMO_VIDEO_PATH'
);
const demoVideoPoster = resolveOptionalStorageAsset(
    process.env.NEXT_PUBLIC_DEMO_VIDEO_POSTER_PATH,
    'NEXT_PUBLIC_DEMO_VIDEO_POSTER_PATH'
);

if (!demoVideoSrc && demoVideoPoster) {
    throw new Error(
        '❌ Environment variable "NEXT_PUBLIC_DEMO_VIDEO_POSTER_PATH" requires "NEXT_PUBLIC_DEMO_VIDEO_PATH"'
    );
}

export const DEMO_VIDEO = demoVideoSrc
    ? {
          src: demoVideoSrc,
          poster: demoVideoPoster,
      }
    : null;

export const DEMO_VIDEO_ENABLED = DEMO_VIDEO !== null;

/**
 * Hero ship loops. A directory rather than a file list: there are four crops
 * (light/dark × tall/wide) and two codecs each, and spelling all eight out in
 * `.env` would duplicate a naming scheme that belongs in code. File names are
 * derived by the hero widget; unset the variable and the hero falls back to
 * its stills, which is also what happens while the bucket is still empty.
 */
const heroVideoBasePath = process.env.NEXT_PUBLIC_HERO_VIDEO_BASE_PATH;

if (heroVideoBasePath?.endsWith('/')) {
    throw new Error(
        '❌ Environment variable "NEXT_PUBLIC_HERO_VIDEO_BASE_PATH" must not end with "/"'
    );
}

export const HERO_VIDEO_BASE_URL = resolveOptionalStorageAsset(
    heroVideoBasePath,
    'NEXT_PUBLIC_HERO_VIDEO_BASE_PATH'
);
