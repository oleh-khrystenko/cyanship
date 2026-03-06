'use client';

import { forwardRef } from 'react';
import { composeClasses } from '@/shared/lib';
import type { UiInputProps, UiInputSize, UiInputVariant } from './types';

const iconSizeMap: Record<UiInputSize, number> = {
    sm: 16,
    md: 20,
    lg: 24,
};

const sizeStyles: Record<UiInputSize, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
};

const variantStyles: Record<UiInputVariant, string> = {
    outlined:
        'bg-transparent text-text-primary border border-border hover:border-text-secondary focus-within:border-primary',
    filled: 'bg-surface-hover text-text-primary border border-transparent hover:bg-surface focus-within:bg-surface',
};

const errorStyles = 'border-error hover:border-error focus-within:border-error';

const UiInput = forwardRef<HTMLInputElement, UiInputProps>((props, ref) => {
    const {
        variant = 'outlined',
        size = 'md',
        error,
        IconLeft,
        IconRight,
        className,
        disabled,
        ...inputProps
    } = props;

    const iconSize = iconSizeMap[size];

    const wrapperClasses = composeClasses(
        'inline-flex items-center gap-2',
        'rounded-md transition-colors',
        sizeStyles[size],
        variantStyles[variant],
        error && errorStyles,
        disabled && 'opacity-50 cursor-not-allowed',
        className
    );

    return (
        <div>
            <label
                className={wrapperClasses}
                data-variant={variant}
                data-size={size}
            >
                {IconLeft && (
                    <IconLeft
                        width={iconSize}
                        height={iconSize}
                        className="shrink-0 text-text-secondary"
                        aria-hidden
                    />
                )}
                <input
                    {...inputProps}
                    ref={ref}
                    disabled={disabled}
                    className="w-full bg-transparent outline-none placeholder:text-text-secondary disabled:cursor-not-allowed"
                />
                {IconRight && (
                    <IconRight
                        width={iconSize}
                        height={iconSize}
                        className="shrink-0 text-text-secondary"
                        aria-hidden
                    />
                )}
            </label>
            {error && (
                <p className="mt-1 text-sm text-error">
                    {error}
                </p>
            )}
        </div>
    );
});

UiInput.displayName = 'UiInput';

export default UiInput;
