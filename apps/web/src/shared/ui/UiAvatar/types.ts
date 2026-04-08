import { ComponentPropsWithoutRef } from 'react';

export type UiAvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface UiAvatarProps extends ComponentPropsWithoutRef<'span'> {
    size?: UiAvatarSize;
}

export type UiAvatarImageProps = ComponentPropsWithoutRef<'img'>;

export interface UiAvatarFallbackProps extends ComponentPropsWithoutRef<'span'> {
    size?: UiAvatarSize;
}
