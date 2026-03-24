import { TextareaHTMLAttributes } from 'react';

export type UiTextareaVariant = 'outlined' | 'filled';
export type UiTextareaSize = 'sm' | 'md' | 'lg';

export interface UiTextareaProps
    extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
    variant?: UiTextareaVariant;
    size?: UiTextareaSize;
    error?: string;
}
