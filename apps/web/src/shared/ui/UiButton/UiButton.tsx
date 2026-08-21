'use client';

import Link from 'next/link';
import { ReactNode, Ref, forwardRef } from 'react';
import { composeClasses } from '@/shared/lib';
import type { UiButtonProps, UiButtonSize, UiButtonVariant } from './types';

/**
 * CSS classes to control icon size via container.
 * Icons passed as ReactNode are sized by the wrapper, not by the caller.
 */
const iconSizeStyles_svg: Record<UiButtonSize, string> = {
    sm: '[&>svg]:size-4',
    md: '[&>svg]:size-5',
    lg: '[&>svg]:size-6',
};

const sizeStyles: Record<UiButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
};

/**
 * Size styles specifically for icon variant (square buttons)
 */
const iconSizeStyles: Record<UiButtonSize, string> = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
};

/**
 * No padding at all — `icon-compact` (size only affects icon scale) and `bare`
 * (the content owns the whole surface, so the button must add nothing).
 */
const iconCompactSizeStyles: Record<UiButtonSize, string> = {
    sm: 'p-0',
    md: 'p-0',
    lg: 'p-0',
};

/** Variants that add no padding of their own. */
const UNPADDED_VARIANTS: UiButtonVariant[] = ['icon-compact', 'bare'];

/**
 * Theme-agnostic variant styles using neutral colors
 * Override via className prop for custom design systems
 */
const variantStyles: Record<UiButtonVariant, string> = {
    filled: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
    outline:
        'border border-muted-foreground/40 bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground active:bg-muted/50',
    soft: 'border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
    'destructive-outline':
        'border border-destructive bg-transparent text-destructive hover:bg-destructive/10 active:bg-destructive/20',
    text: 'bg-transparent text-muted-foreground hover:text-foreground',
    'destructive-text':
        'bg-transparent text-destructive hover:text-destructive/80',
    icon: 'bg-transparent text-muted-foreground hover:text-foreground',
    'icon-compact':
        'bg-transparent text-muted-foreground hover:text-foreground',
    // For rows whose surface — background, padding, hover — belongs to the
    // content: tab strips, list rows, cards behind a single hit area. Every
    // other variant declares its own background and colour, and `composeClasses`
    // only concatenates, so a surface handed over in `className` would be
    // resolved by the order Tailwind happened to emit the rules in. `bare`
    // declares none, keeps what a primitive must own (the element, the type,
    // the cursor, the disabled handling) and stretches its content wrapper to
    // the full button — so callers never have to reach into the markup.
    bare: 'bg-transparent',
};

interface RenderContentProps {
    IconLeft?: ReactNode;
    IconRight?: ReactNode;
    children?: ReactNode;
    size: UiButtonSize;
    /**
     * `bare` hands its whole surface to the content, so the wrapper has to fill
     * the button. Kept here rather than left to the caller: the wrapper is this
     * component's own markup, and a caller reaching in for it with a child
     * selector would break silently the day the markup changes.
     */
    stretchContent?: boolean;
}

const renderContent = ({
    IconLeft,
    IconRight,
    children,
    size,
    stretchContent,
}: RenderContentProps) => {
    const sizeClass = iconSizeStyles_svg[size];
    return (
        <>
            {IconLeft && (
                <span className={sizeClass} aria-hidden>
                    {IconLeft}
                </span>
            )}
            {children && (
                <span className={stretchContent ? 'w-full' : undefined}>
                    {children}
                </span>
            )}
            {IconRight && (
                <span className={sizeClass} aria-hidden>
                    {IconRight}
                </span>
            )}
        </>
    );
};

/**
 * Shared UI attributes for all button/link variants
 */
interface CommonProps {
    className: string;
    variant: UiButtonVariant;
    size: UiButtonSize;
}

const getCommonProps = ({ className, variant, size }: CommonProps) => ({
    className,
    'data-variant': variant,
    'data-size': size,
});

/**
 * Additional props for link elements (internal and external)
 */
const getLinkAccessibilityProps = (disabled?: boolean) => ({
    'aria-disabled': disabled,
    tabIndex: disabled ? -1 : undefined,
});

const UiButton = forwardRef<
    HTMLButtonElement | HTMLAnchorElement,
    UiButtonProps
>((props, ref) => {
    const {
        children,
        className,
        variant = 'filled',
        size = 'md',
        IconLeft,
        IconRight,
        disabled,
    } = props;

    const classes = composeClasses(
        'inline-flex items-center justify-center rounded-lg',
        variant !== 'icon' && !UNPADDED_VARIANTS.includes(variant) && 'gap-2',
        'cursor-pointer disabled:cursor-not-allowed',
        'focus:outline-none',
        'transition-colors',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        variant === 'icon'
            ? iconSizeStyles[size]
            : UNPADDED_VARIANTS.includes(variant)
              ? iconCompactSizeStyles[size]
              : sizeStyles[size],
        variantStyles[variant],
        className
    );

    const content = renderContent({
        IconLeft,
        IconRight,
        children,
        size,
        stretchContent: variant === 'bare',
    });
    const commonProps = getCommonProps({ className: classes, variant, size });
    const accessibilityProps = getLinkAccessibilityProps(disabled);

    // Type guard: Native anchor element
    if (props.as === 'a') {
        const {
            as: _as,
            href,
            variant: _variant,
            size: _size,
            className: _className,
            IconLeft: _iconLeft,
            IconRight: _iconRight,
            disabled: _disabled,
            children: _children,
            ...anchorProps
        } = props;

        return (
            <a
                {...anchorProps}
                {...commonProps}
                {...accessibilityProps}
                href={href}
                onClick={(e) => {
                    if (disabled) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    anchorProps.onClick?.(e);
                }}
                ref={ref as Ref<HTMLAnchorElement>}
            >
                {content}
            </a>
        );
    }

    // Type guard: Internal link
    if (props.as === 'link') {
        const {
            as: _as,
            href,
            variant: _variant,
            size: _size,
            className: _className,
            IconLeft: _iconLeft,
            IconRight: _iconRight,
            disabled: _disabled,
            children: _children,
            ...linkProps
        } = props;

        return (
            <Link
                {...linkProps}
                {...commonProps}
                {...accessibilityProps}
                href={href}
                onClick={(e) => {
                    if (disabled) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    linkProps.onClick?.(e);
                }}
                ref={ref as Ref<HTMLAnchorElement>}
            >
                {content}
            </Link>
        );
    }

    // Default: Button
    const {
        as: _as,
        variant: _variant,
        size: _size,
        className: _className,
        IconLeft: _iconLeft,
        IconRight: _iconRight,
        disabled: _disabled,
        children: _children,
        ...buttonProps
    } = props;

    return (
        <button
            {...buttonProps}
            {...commonProps}
            type={buttonProps.type ?? 'button'}
            disabled={disabled}
            onClick={(e) => {
                if (disabled) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                buttonProps.onClick?.(e);
            }}
            ref={ref as Ref<HTMLButtonElement>}
        >
            {content}
        </button>
    );
});

UiButton.displayName = 'UiButton';

export default UiButton;
