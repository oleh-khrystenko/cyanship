'use client';

import Image from 'next/image';
import { useCallback, useState } from 'react';

import { composeClasses } from '@/shared/lib';
import type { UiAvatarProps, UiAvatarSize } from './types';

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

// The largest variant is `2xl` = `size-24` = 96px. Capping `sizes` at
// 96px keeps the network payload tiny while still letting retina screens
// pick a 2x source from the optimizer's srcset.
const AVATAR_IMAGE_SIZES = '96px';

function UiAvatar({
    src,
    alt = '',
    fallback,
    size = 'sm',
    priority = false,
    className,
    ...props
}: UiAvatarProps) {
    // Tracking the failed source (rather than a boolean) makes recovery
    // automatic when `src` changes — a new url is shown immediately
    // without an effect to reset error state, and the previous failure
    // is forgotten the moment it stops being relevant.
    const [failedSrc, setFailedSrc] = useState<string | null>(null);

    const handleError = useCallback(() => {
        if (src) setFailedSrc(src);
    }, [src]);

    const showImage = Boolean(src) && failedSrc !== src;

    return (
        <span
            {...props}
            className={composeClasses(
                // The root owns the avatar's full visual identity —
                // shape, neutral surface, ring, centered layout. The
                // surface is painted on the very first frame, so while
                // the image decodes the user sees a calm neutral disc
                // instead of a flash of initials. Initials render only
                // when there is genuinely no image to show (no src or
                // load failed) — never as a transient loading state.
                'bg-secondary text-foreground relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-1 ring-border/40',
                rootSizeStyles[size],
                className
            )}
        >
            {showImage ? (
                <Image
                    // `key` forces a fresh <img> when src changes so the
                    // browser cannot reuse the previous element's decoded
                    // bitmap during the swap (which would otherwise paint
                    // the old avatar for one frame after navigation).
                    key={src}
                    src={src as string}
                    alt={alt}
                    fill
                    sizes={AVATAR_IMAGE_SIZES}
                    priority={priority}
                    onError={handleError}
                    className="object-cover"
                />
            ) : (
                <span
                    aria-hidden={alt ? undefined : true}
                    className={composeClasses(
                        'select-none',
                        fallbackTextStyles[size]
                    )}
                >
                    {fallback}
                </span>
            )}
        </span>
    );
}

export { UiAvatar };
