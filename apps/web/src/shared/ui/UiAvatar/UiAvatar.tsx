'use client';

import Image, { type ImageProps } from 'next/image';
import {
    createContext,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react';

import { composeClasses } from '@/shared/lib';
import type {
    UiAvatarFallbackProps,
    UiAvatarImageProps,
    UiAvatarProps,
    UiAvatarSize,
} from './types';

type AvatarImageStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface AvatarContextValue {
    status: AvatarImageStatus;
    setStatus: (status: AvatarImageStatus) => void;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

function useAvatarContext(component: string): AvatarContextValue {
    const ctx = useContext(AvatarContext);
    if (!ctx) {
        throw new Error(`${component} must be used inside <UiAvatar>`);
    }
    return ctx;
}

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

// Largest avatar variant is `2xl` = `size-24` = 96px. The Next image
// optimizer uses `sizes` to pick a srcset entry; capping at 96px keeps
// the network payload tiny while still letting retina screens pick a
// 2x source.
const AVATAR_IMAGE_SIZES = '96px';

function UiAvatar({ className, size = 'sm', ...props }: UiAvatarProps) {
    const [status, setStatus] = useState<AvatarImageStatus>('idle');
    const value = useMemo<AvatarContextValue>(
        () => ({ status, setStatus }),
        [status]
    );

    return (
        <AvatarContext.Provider value={value}>
            <span
                className={composeClasses(
                    'relative flex shrink-0 overflow-hidden rounded-full ring-1 ring-border/40',
                    rootSizeStyles[size],
                    className
                )}
                {...props}
            />
        </AvatarContext.Provider>
    );
}

function UiAvatarImage({
    className,
    src,
    alt = '',
    onLoad,
    onError,
    ...props
}: UiAvatarImageProps) {
    const { status, setStatus } = useAvatarContext('UiAvatarImage');

    // Reset whenever the source changes so switching avatars (e.g. profile
    // update) re-runs the load cycle deterministically.
    useLayoutEffect(() => {
        setStatus(src ? 'loading' : 'idle');
    }, [src, setStatus]);

    const handleLoad = useCallback<NonNullable<ImageProps['onLoad']>>(
        (event) => {
            setStatus('loaded');
            onLoad?.(event);
        },
        [onLoad, setStatus]
    );

    const handleError = useCallback<NonNullable<ImageProps['onError']>>(
        (event) => {
            setStatus('error');
            onError?.(event);
        },
        [onError, setStatus]
    );

    if (!src || status === 'error') {
        return null;
    }

    // The image is rendered in the SSR'd HTML and never gated on React
    // state, so the browser starts fetching during document parse and
    // paints the bytes the moment they arrive — including on cache hits,
    // where the image is ready before the first paint and the user never
    // sees a flash of fallback. <UiAvatarFallback> sits behind the image
    // in painting order (normal flow vs. absolute-positioned `fill`),
    // visible only while the <img> has no painted content yet. State is
    // only used to (a) unmount on error and (b) drop the fallback from
    // the DOM after load for accessibility.
    return (
        <Image
            {...props}
            src={src}
            alt={alt}
            fill
            sizes={AVATAR_IMAGE_SIZES}
            onLoad={handleLoad}
            onError={handleError}
            className={composeClasses('object-cover', className)}
        />
    );
}

function UiAvatarFallback({
    className,
    size = 'sm',
    ...props
}: UiAvatarFallbackProps) {
    const { status } = useAvatarContext('UiAvatarFallback');

    if (status === 'loaded') {
        return null;
    }

    return (
        <span
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
