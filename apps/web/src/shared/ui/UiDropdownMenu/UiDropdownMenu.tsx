'use client';

import { forwardRef, Fragment } from 'react';
import {
    Menu,
    MenuButton,
    MenuItem,
    MenuItems,
} from '@headlessui/react';
import { composeClasses } from '@/shared/lib';
import type {
    UiDropdownMenuProps,
    UiDropdownMenuSize,
    UiDropdownMenuAlign,
} from './types';

const itemSizeStyles: Record<UiDropdownMenuSize, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
};

const iconSizeStyles: Record<UiDropdownMenuSize, string> = {
    sm: '[&>svg]:size-4',
    md: '[&>svg]:size-5',
    lg: '[&>svg]:size-6',
};

const alignStyles: Record<UiDropdownMenuAlign, string> = {
    start: 'left-0',
    end: 'right-0',
};

const UiDropdownMenu = forwardRef<HTMLDivElement, UiDropdownMenuProps>(
    (props, ref) => {
        const {
            items,
            onSelect,
            activeValue,
            trigger,
            align = 'end',
            size = 'md',
            className,
        } = props;

        return (
            <Menu as="div" className="relative" ref={ref}>
                <MenuButton as={Fragment}>{trigger}</MenuButton>

                <MenuItems
                    className={composeClasses(
                        'absolute z-50 mt-1 min-w-32',
                        'rounded-lg border border-border bg-card shadow-md',
                        'focus:outline-none',
                        alignStyles[align],
                        className
                    )}
                >
                    <div className="p-1">
                        {items.map((item) => {
                            const isActive = activeValue === item.value;
                            return (
                                <MenuItem key={item.value}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(item.value)}
                                        className={composeClasses(
                                            'flex w-full items-center gap-2',
                                            'cursor-pointer rounded-md transition-colors',
                                            'data-[focus]:bg-accent',
                                            isActive && 'bg-accent',
                                            itemSizeStyles[size],
                                            iconSizeStyles[size]
                                        )}
                                    >
                                        {item.icon && (
                                            <span aria-hidden>
                                                {item.icon}
                                            </span>
                                        )}
                                        <span>{item.label}</span>
                                    </button>
                                </MenuItem>
                            );
                        })}
                    </div>
                </MenuItems>
            </Menu>
        );
    }
);

UiDropdownMenu.displayName = 'UiDropdownMenu';

export default UiDropdownMenu;
