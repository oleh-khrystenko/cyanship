'use client';

import { forwardRef, useId } from 'react';
import { composeClasses } from '@/shared/lib';
import type {
    UiTextareaProps,
    UiTextareaSize,
    UiTextareaVariant,
} from './types';

const sizeStyles: Record<UiTextareaSize, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
};

const variantStyles: Record<UiTextareaVariant, string> = {
    outlined:
        'bg-transparent text-foreground border border-border hover:border-muted-foreground focus-within:border-primary',
    filled: 'bg-secondary text-foreground border border-transparent hover:bg-card focus-within:bg-card',
};

const errorStyles =
    'border-destructive hover:border-destructive focus-within:border-destructive';

const UiTextarea = forwardRef<HTMLTextAreaElement, UiTextareaProps>(
    (props, ref) => {
        const {
            variant = 'outlined',
            size = 'md',
            label,
            labelHint,
            error,
            className,
            disabled,
            id: externalId,
            ...textareaProps
        } = props;

        const generatedId = useId();
        const textareaId = externalId ?? generatedId;

        const wrapperClasses = composeClasses(
            'rounded-md transition-colors',
            sizeStyles[size],
            variantStyles[variant],
            error && errorStyles,
            disabled && 'opacity-50 cursor-not-allowed',
            className,
        );

        return (
            <div>
                {label && (
                    <label
                        htmlFor={textareaId}
                        className="mb-1 block text-sm font-medium text-foreground"
                    >
                        {label}
                        {labelHint && (
                            <span className="ml-1 font-normal text-muted-foreground">
                                {labelHint}
                            </span>
                        )}
                    </label>
                )}
                <div
                    className={wrapperClasses}
                    data-variant={variant}
                    data-size={size}
                >
                    <textarea
                        {...textareaProps}
                        id={textareaId}
                        ref={ref}
                        disabled={disabled}
                        className="w-full resize-y bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                    />
                </div>
                {error && (
                    <p className="mt-1 text-sm text-destructive">{error}</p>
                )}
            </div>
        );
    },
);

UiTextarea.displayName = 'UiTextarea';

export default UiTextarea;
