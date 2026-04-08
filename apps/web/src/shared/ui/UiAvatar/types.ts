import type { ComponentPropsWithoutRef } from 'react';
import type { ImageProps } from 'next/image';

export type UiAvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface UiAvatarProps extends ComponentPropsWithoutRef<'span'> {
    size?: UiAvatarSize;
}

// next/image owns the underlying <img>. The avatar primitive controls
// layout (`fill`, `sizes`) and image source typing itself, so those props
// are intentionally omitted to keep a single, unambiguous API surface.
// `alt` is relaxed to optional because avatars are decorative when shown
// next to the user's name; consumers can still pass it for screen readers.
export type UiAvatarImageProps = Omit<
    ImageProps,
    'fill' | 'sizes' | 'width' | 'height' | 'loader' | 'src' | 'alt'
> & {
    src: string | undefined;
    alt?: string;
};

export interface UiAvatarFallbackProps extends ComponentPropsWithoutRef<'span'> {
    size?: UiAvatarSize;
}
