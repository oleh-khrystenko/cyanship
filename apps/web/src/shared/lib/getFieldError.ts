import type { FieldError } from 'react-hook-form';

type ErrorMessageMap = {
    required?: string;
    too_small?: string;
    too_big?: string;
    invalid_string?: string;
    invalid_format?: string;
    custom?: string;
};

/**
 * Maps a React Hook Form / Zod field error to the appropriate i18n message.
 *
 * When Zod's `too_small` covers both "required" (empty) and "min length" cases,
 * pass the current field value — the helper will use `required` for empty values
 * and `too_small` for non-empty values that are still below minimum.
 */
export function getFieldError(
    error: FieldError | undefined,
    messages: ErrorMessageMap,
    value?: string
): string | undefined {
    if (!error) return undefined;

    if (error.type === 'too_big' && messages.too_big) return messages.too_big;

    if (error.type === 'custom' && messages.custom) return messages.custom;

    // Zod 4 renamed the format issue: what arrived as `invalid_string` (email,
    // url, regex) now arrives as `invalid_format`. Both names mean the same
    // thing, so either message answers either code — without that, a mistyped
    // address falls through to the `required` text and tells the visitor
    // nothing about what is actually wrong.
    if (error.type === 'invalid_string' || error.type === 'invalid_format') {
        const formatMessage =
            error.type === 'invalid_string'
                ? (messages.invalid_string ?? messages.invalid_format)
                : (messages.invalid_format ?? messages.invalid_string);

        if (formatMessage) return formatMessage;
    }

    if (error.type === 'too_small') {
        if (messages.required && !value?.trim()) return messages.required;
        if (messages.too_small) return messages.too_small;
        return messages.required;
    }

    return messages.required;
}
