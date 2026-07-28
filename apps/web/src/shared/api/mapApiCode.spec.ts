import { AxiosError, AxiosHeaders } from 'axios';
import {
    getApiMessageKey,
    getApiErrorCode,
    getApiErrorMessage,
} from './mapApiCode';

function apiError(
    code: string | undefined,
    headers: Record<string, string> = {},
): AxiosError {
    const error = new AxiosError('request failed');
    error.response = {
        data: code ? { error: { code, message: 'dev message' } } : {},
        status: 400,
        statusText: 'Bad Request',
        headers,
        config: { headers: new AxiosHeaders() },
    };
    return error;
}

describe('getApiMessageKey', () => {
    it('returns notifications path for success code with module', () => {
        expect(getApiMessageKey('MAGIC_LINK_SENT', 'auth')).toBe(
            'notifications.auth.magic_link_sent'
        );
    });

    it('returns notifications path for other success codes', () => {
        expect(getApiMessageKey('LOGGED_OUT', 'auth')).toBe(
            'notifications.auth.logged_out'
        );
        expect(getApiMessageKey('PASSWORD_SET', 'auth')).toBe(
            'notifications.auth.password_set'
        );
        expect(getApiMessageKey('LANG_UPDATED', 'users')).toBe(
            'notifications.users.lang_updated'
        );
    });

    it('returns errors path for error code with module', () => {
        expect(getApiMessageKey('UNAUTHORIZED', 'auth')).toBe(
            'errors.auth.unauthorized'
        );
    });

    it('returns errors.generic path for error code without module', () => {
        expect(getApiMessageKey('UNAUTHORIZED')).toBe(
            'errors.generic.unauthorized'
        );
    });

    it('returns errors.generic path for unknown code without module', () => {
        expect(getApiMessageKey('UNKNOWN_CODE')).toBe(
            'errors.generic.unknown_code'
        );
    });

    it('returns errors path for unknown code with module (no type mapping)', () => {
        expect(getApiMessageKey('SOME_UNKNOWN', 'auth')).toBe(
            'errors.auth.some_unknown'
        );
    });

    it('lowercases the code in the key', () => {
        expect(getApiMessageKey('RATE_LIMIT_EXCEEDED', 'auth')).toBe(
            'errors.auth.rate_limit_exceeded'
        );
    });
});

describe('getApiErrorCode', () => {
    it('returns the code from an API error response', () => {
        expect(getApiErrorCode(apiError('INSUFFICIENT_EXECUTIONS'))).toBe(
            'INSUFFICIENT_EXECUTIONS'
        );
    });

    it('returns undefined for a code outside the registry', () => {
        expect(getApiErrorCode(apiError('SOME_MADE_UP_CODE'))).toBeUndefined();
    });

    it('returns undefined for a non-axios error', () => {
        expect(getApiErrorCode(new Error('boom'))).toBeUndefined();
    });
});

describe('getApiErrorMessage', () => {
    it('resolves a code to its owning module', () => {
        expect(getApiErrorMessage(apiError('EXECUTIONS_RESERVATION_ACTIVE'))).toEqual(
            { key: 'errors.users.executions_reservation_active' }
        );
    });

    it('resolves onboarding block to its generic message', () => {
        expect(getApiErrorMessage(apiError('ONBOARDING_INCOMPLETE'))).toEqual({
            key: 'errors.generic.onboarding_incomplete',
        });
    });

    it('converts retry-after seconds into minutes', () => {
        expect(
            getApiErrorMessage(
                apiError('RATE_LIMIT_EXCEEDED', { 'retry-after': '90' })
            )
        ).toEqual({
            key: 'errors.generic.rate_limit_exceeded',
            values: { minutes: 2 },
        });
    });

    it('falls back to a default wait when retry-after is missing or unusable', () => {
        expect(getApiErrorMessage(apiError('RATE_LIMIT_EXCEEDED'))).toEqual({
            key: 'errors.generic.rate_limit_exceeded',
            values: { minutes: 15 },
        });
        expect(
            getApiErrorMessage(
                apiError('RATE_LIMIT_EXCEEDED', { 'retry-after': 'soon' })
            )
        ).toEqual({
            key: 'errors.generic.rate_limit_exceeded',
            values: { minutes: 15 },
        });
    });

    it('falls back to the generic message for codes without their own text', () => {
        expect(getApiErrorMessage(apiError('NOT_FOUND'))).toEqual({
            key: 'errors.generic.unknown',
        });
        expect(getApiErrorMessage(apiError(undefined))).toEqual({
            key: 'errors.generic.unknown',
        });
        expect(getApiErrorMessage(new Error('boom'))).toEqual({
            key: 'errors.generic.unknown',
        });
    });
});
