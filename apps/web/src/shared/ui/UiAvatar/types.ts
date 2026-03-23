import { ComponentPropsWithoutRef } from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

export type UiAvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface UiAvatarProps
    extends ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
    size?: UiAvatarSize;
}

export type UiAvatarImageProps = ComponentPropsWithoutRef<
    typeof AvatarPrimitive.Image
>;

export interface UiAvatarFallbackProps
    extends ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
    size?: UiAvatarSize;
}
