import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export type UiAvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface UiAvatarProps
    extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
    /**
     * Image source. When falsy or after a load error, the avatar
     * displays `fallback` instead. Accepts `null`/`undefined` so callers
     * can pass optional fields directly without nullish coalescing.
     */
    src?: string | null;
    /**
     * Alt text for the underlying image. Defaults to empty string —
     * avatars are typically decorative when shown next to the user's name.
     */
    alt?: string;
    /**
     * Content shown when there is no image or the image fails to load
     * (typically initials). Required so the avatar always has something
     * meaningful to render.
     */
    fallback: ReactNode;
    size?: UiAvatarSize;
    /**
     * Forwarded to `next/image`. Use for above-the-fold avatars (e.g.
     * the header) so the loader prioritizes them.
     */
    priority?: boolean;
}
