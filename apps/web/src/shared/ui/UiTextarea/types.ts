import { type ReactNode, type TextareaHTMLAttributes } from 'react';

export type UiTextareaVariant = 'outlined' | 'filled';
export type UiTextareaSize = 'sm' | 'md' | 'lg';

export interface UiTextareaProps
    extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
    variant?: UiTextareaVariant;
    size?: UiTextareaSize;
    label?: string;
    error?: string;
    /** Element rendered inside the wrapper, after the textarea (e.g. submit button). */
    suffix?: ReactNode;
}
