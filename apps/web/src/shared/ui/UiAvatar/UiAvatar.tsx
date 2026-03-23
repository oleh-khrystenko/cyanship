'use client';

import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { composeClasses } from '@/shared/lib';
import type {
    UiAvatarProps,
    UiAvatarImageProps,
    UiAvatarFallbackProps,
    UiAvatarSize,
} from './types';

const rootSizeStyles: Record<UiAvatarSize, string> = {
    sm: 'size-8',
    md: 'size-10',
    lg: 'size-12',
    xl: 'size-20',
    '2xl': 'size-24',
};

const fallbackTextStyles: Record<UiAvatarSize, string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-2xl',
    '2xl': 'text-3xl',
};

function UiAvatar({ className, size = 'sm', ...props }: UiAvatarProps) {
    return (
        <AvatarPrimitive.Root
            className={composeClasses(
                'relative flex shrink-0 overflow-hidden rounded-full ring-1 ring-border/40',
                rootSizeStyles[size],
                className
            )}
            {...props}
        />
    );
}

function UiAvatarImage({ className, ...props }: UiAvatarImageProps) {
    return (
        <AvatarPrimitive.Image
            className={composeClasses(
                'aspect-square size-full',
                className
            )}
            {...props}
        />
    );
}

function UiAvatarFallback({
    className,
    size = 'sm',
    ...props
}: UiAvatarFallbackProps) {
    return (
        <AvatarPrimitive.Fallback
            className={composeClasses(
                'bg-secondary text-foreground flex size-full items-center justify-center rounded-full font-semibold',
                fallbackTextStyles[size],
                className
            )}
            {...props}
        />
    );
}

export { UiAvatar, UiAvatarImage, UiAvatarFallback };
