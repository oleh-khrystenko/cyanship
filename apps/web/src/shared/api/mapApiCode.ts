import { AxiosError } from 'axios';
import {
    RESPONSE_CODE,
    RESPONSE_CODE_TYPE,
    RESPONSE_TYPE,
    type ResponseCode,
} from '@cyanship/types';

/**
 * Returns an i18n key for the given API response code.
 *
 * Priority:
 * 1. notifications.{module}.{code_lower}  (success codes, if module provided)
 * 2. errors.{module}.{code_lower}         (error codes, if module provided)
 * 3. errors.generic.{code_lower}          (fallback)
 * 4. errors.generic.unknown               (final fallback)
 */
export function getApiMessageKey(code: string, module?: string): string {
    const lower = code.toLowerCase();
    const type = RESPONSE_CODE_TYPE[code as keyof typeof RESPONSE_CODE_TYPE];

    if (type === RESPONSE_TYPE.SUCCESS && module) {
        return `notifications.${module}.${lower}`;
    }

    if (module) {
        return `errors.${module}.${lower}`;
    }

    return `errors.generic.${lower}`;
}

/**
 * Namespace that owns the localized message of each error code — the single
 * source of truth for `errors.{module}.{code}` lookups.
 *
 * Scope: codes carried by an HTTP error response, i.e. members of
 * `RESPONSE_CODE`. Codes that reach the client through another channel — the
 * AI chat SSE stream emits `AI_PROVIDER_ERROR`, which is not a `ResponseCode` —
 * are mapped at their own call site via `getApiMessageKey`.
 *
 * A code absent from this map has no message in `messages/{locale}.json`, so
 * `getApiErrorMessage` falls back to `errors.generic.unknown` instead of
 * building a key that resolves to nothing (docs/conventions/i18n.md).
 * Adding a message for an HTTP error code means adding the code here as well.
 */
const ERROR_CODE_MODULE: Partial<Record<ResponseCode, string>> = {
    [RESPONSE_CODE.UNAUTHORIZED]: 'auth',

    [RESPONSE_CODE.ALREADY_SUBSCRIBED]: 'payments',
    [RESPONSE_CODE.SUBSCRIPTION_REQUIRED]: 'payments',
    [RESPONSE_CODE.NO_BILLING_ACCOUNT]: 'payments',

    [RESPONSE_CODE.INSUFFICIENT_EXECUTIONS]: 'users',
    [RESPONSE_CODE.EXECUTIONS_RESERVATION_ACTIVE]: 'users',

    [RESPONSE_CODE.CAPTCHA_FAILED]: 'agency',

    [RESPONSE_CODE.AI_LIMIT_EXHAUSTED]: 'ai',
    [RESPONSE_CODE.AI_RATE_LIMIT_EXCEEDED]: 'ai',
    [RESPONSE_CODE.AI_MESSAGE_TOO_LONG]: 'ai',

    [RESPONSE_CODE.AVATAR_UPLOAD_FAILED]: 'storage',
    [RESPONSE_CODE.AVATAR_FILE_KEY_INVALID]: 'storage',
    [RESPONSE_CODE.AVATAR_UPLOAD_NOT_FOUND]: 'storage',
    [RESPONSE_CODE.AVATAR_UPLOAD_INVALID]: 'storage',

    [RESPONSE_CODE.VALIDATION_ERROR]: 'generic',
    [RESPONSE_CODE.RATE_LIMIT_EXCEEDED]: 'generic',
    [RESPONSE_CODE.EMAIL_SEND_FAILED]: 'generic',
    [RESPONSE_CODE.INTERNAL_ERROR]: 'generic',
    [RESPONSE_CODE.ONBOARDING_INCOMPLETE]: 'generic',
};

/** Used when the API throttles without a usable `Retry-After` header. */
const RATE_LIMIT_FALLBACK_MINUTES = 15;

export interface ApiErrorMessage {
    /** i18n key, always resolvable. */
    key: string;
    /** Interpolation values, when the message has placeholders. */
    values?: Record<string, string | number>;
}

/** Extracts the machine-readable code from an API error, if there is one. */
export function getApiErrorCode(error: unknown): ResponseCode | undefined {
    if (!(error instanceof AxiosError)) return undefined;

    const code: unknown = error.response?.data?.error?.code;

    return typeof code === 'string' && code in RESPONSE_CODE_TYPE
        ? (code as ResponseCode)
        : undefined;
}

function getRetryAfterMinutes(error: unknown): number {
    const header =
        error instanceof AxiosError
            ? error.response?.headers?.['retry-after']
            : undefined;

    const seconds = Number(header);

    return Number.isFinite(seconds) && seconds > 0
        ? Math.ceil(seconds / 60)
        : RATE_LIMIT_FALLBACK_MINUTES;
}

/**
 * Maps an API error to a localized message. Codes without a message of their
 * own resolve to `errors.generic.unknown` — a raw i18n key must never reach
 * the user.
 */
export function getApiErrorMessage(error: unknown): ApiErrorMessage {
    const code = getApiErrorCode(error);
    const owningModule = code ? ERROR_CODE_MODULE[code] : undefined;

    if (!code || !owningModule) return { key: 'errors.generic.unknown' };

    const key = getApiMessageKey(code, owningModule);

    if (code === RESPONSE_CODE.RATE_LIMIT_EXCEEDED) {
        return { key, values: { minutes: getRetryAfterMinutes(error) } };
    }

    return { key };
}
