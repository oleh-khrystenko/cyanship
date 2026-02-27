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
        'bg-transparent text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500 focus:border-neutral-500 dark:focus:border-neutral-400 disabled:border-neutral-200 disabled:text-neutral-400',
    filled: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-transparent hover:bg-neutral-200 dark:hover:bg-neutral-700 focus:bg-neutral-50 dark:focus:bg-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400',
};

const errorStyles =
    'border-red-500 dark:border-red-400 hover:border-red-600 dark:hover:border-red-300 focus:border-red-500 dark:focus:border-red-400';

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
                        className="shrink-0 text-neutral-400"
                        aria-hidden
                    />
                )}
                <input
                    {...inputProps}
                    ref={ref}
                    disabled={disabled}
                    className="w-full bg-transparent outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
                />
                {IconRight && (
                    <IconRight
                        width={iconSize}
                        height={iconSize}
                        className="shrink-0 text-neutral-400"
                        aria-hidden
                    />
                )}
            </label>
            {error && (
                <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
});

UiInput.displayName = 'UiInput';

export default UiInput;
