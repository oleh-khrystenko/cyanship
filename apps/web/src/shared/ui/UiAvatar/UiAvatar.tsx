'use client';

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
    style,
    alt = '',
    onLoad,
    onError,
    ...props
}: UiAvatarImageProps) {
    const { status, setStatus } = useAvatarContext('UiAvatarImage');

    // Reset status whenever the source changes so that switching avatars
    // (e.g. profile update) re-runs the load cycle deterministically.
    useLayoutEffect(() => {
        setStatus(src ? 'loading' : 'idle');
    }, [src, setStatus]);

    const handleLoad = useCallback<
        NonNullable<UiAvatarImageProps['onLoad']>
    >(
        (event) => {
            setStatus('loaded');
            onLoad?.(event);
        },
        [onLoad, setStatus]
    );

    const handleError = useCallback<
        NonNullable<UiAvatarImageProps['onError']>
    >(
        (event) => {
            setStatus('error');
            onError?.(event);
        },
        [onError, setStatus]
    );

    if (!src || status === 'error') {
        return null;
    }

    // Image stays in the DOM while loading so that React's onLoad listener
    // is attached before the browser dispatches the load event — even when
    // the resource is served from cache. We just hide it visually until the
    // browser confirms it has actually loaded, which lets <UiAvatarFallback>
    // own the visible slot during loading. next/image is intentionally not
    // used here: avatar URLs come from arbitrary third-party providers
    // (e.g. Google CDN) and the optimizer would require host allow-listing
    // for every provider users sign in with.
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            {...props}
            src={src}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className={composeClasses('aspect-square size-full', className)}
            style={
                status === 'loaded' ? style : { ...style, display: 'none' }
            }
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
