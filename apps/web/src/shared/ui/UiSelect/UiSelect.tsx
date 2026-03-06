'use client';

import { forwardRef } from 'react';
import {
    Listbox,
    ListboxButton,
    ListboxOption,
    ListboxOptions,
} from '@headlessui/react';
import { ChevronDown } from 'lucide-react';
import { composeClasses } from '@/shared/lib';
import type { UiSelectProps, UiSelectSize, UiSelectVariant } from './types';

const sizeStyles: Record<UiSelectSize, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
};

/**
 * Theme-agnostic variant styles using neutral colors
 * Override via className prop for custom design systems
 */
const variantStyles: Record<UiSelectVariant, string> = {
    filled: 'bg-primary text-white hover:bg-primary-dark',
    outlined:
        'bg-transparent text-text-primary border border-border hover:border-text-secondary',
};

const optionStyles: Record<UiSelectVariant, string> = {
    filled: 'bg-primary text-white data-[focus]:bg-primary-dark data-[selected]:bg-primary-dark',
    outlined:
        'bg-transparent text-text-primary data-[focus]:bg-surface-hover data-[selected]:bg-surface-hover',
};

const UiSelect = forwardRef<HTMLButtonElement, UiSelectProps>((props, ref) => {
    const {
        options,
        value,
        onChange,
        variant = 'filled',
        size = 'md',
        className,
        disabled = false,
        placeholder = 'Select an option',
        label,
    } = props;

    const selected = options.find((o) => o.value === value);

    const buttonClasses = composeClasses(
        'inline-flex items-center justify-between gap-2',
        'cursor-pointer disabled:cursor-not-allowed',
        'focus:outline-none',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        sizeStyles[size],
        variantStyles[variant],
        className
    );

    const optionsClasses = composeClasses(
        'absolute z-50 mt-1 w-full',
        'focus:outline-none',
        optionStyles[variant]
    );

    return (
        <Listbox value={value} onChange={onChange} disabled={disabled}>
            <div className="relative">
                <ListboxButton
                    ref={ref}
                    aria-label={label}
                    className={buttonClasses}
                    data-variant={variant}
                    data-size={size}
                >
                    <span>{selected?.label || placeholder}</span>
                    <ChevronDown className="h-4 w-4" />
                </ListboxButton>

                <ListboxOptions className={optionsClasses}>
                    {options.map((option) => (
                        <ListboxOption
                            key={option.value}
                            value={option.value}
                            className={composeClasses(
                                'cursor-pointer select-none',
                                sizeStyles[size]
                            )}
                        >
                            {option.label}
                        </ListboxOption>
                    ))}
                </ListboxOptions>
            </div>
        </Listbox>
    );
});

UiSelect.displayName = 'UiSelect';

export default UiSelect;
