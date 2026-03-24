'use client';

import { forwardRef, useId } from 'react';
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
    filled: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outlined:
        'bg-transparent text-foreground border border-border hover:border-muted-foreground',
};

const optionStyles: Record<UiSelectVariant, string> = {
    filled: 'bg-primary text-primary-foreground data-[focus]:bg-primary/90 data-[selected]:bg-primary/90',
    outlined:
        'bg-transparent text-foreground data-[focus]:bg-secondary data-[selected]:bg-secondary',
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

    const generatedId = useId();
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
                {label && (
                    <label
                        id={generatedId}
                        className="mb-1 block text-sm font-medium text-foreground"
                    >
                        {label}
                    </label>
                )}
                <ListboxButton
                    ref={ref}
                    aria-labelledby={label ? generatedId : undefined}
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
