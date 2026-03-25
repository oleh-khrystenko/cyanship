import type { ComponentPropsWithoutRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

export interface UiModalProps
    extends ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {}
export interface UiModalTriggerProps
    extends ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger> {}
export interface UiModalCloseProps
    extends ComponentPropsWithoutRef<typeof DialogPrimitive.Close> {}

export interface UiModalContentProps
    extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
    hideOverlay?: boolean;
    hideCloseButton?: boolean;
}

export interface UiModalHeaderProps
    extends React.HTMLAttributes<HTMLDivElement> {}
export interface UiModalTitleProps
    extends ComponentPropsWithoutRef<typeof DialogPrimitive.Title> {}
