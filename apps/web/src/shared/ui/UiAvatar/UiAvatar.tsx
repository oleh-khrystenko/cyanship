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
};

const fallbackTextStyles: Record<UiAvatarSize, string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
};

function UiAvatar({ className, size = 'sm', ...props }: UiAvatarProps) {
    return (
        <AvatarPrimitive.Root
            className={composeClasses(
                'relative flex shrink-0 overflow-hidden rounded-full',
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
