import {
    AnchorHTMLAttributes,
    ButtonHTMLAttributes,
    ComponentType,
    ReactNode,
    SVGProps,
} from 'react';
import { LinkProps } from 'next/link';

export type UiButtonVariant = 'filled' | 'text' | 'icon' | 'icon-compact';
export type UiButtonSize = 'sm' | 'md' | 'lg';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Base props shared by all button variants
 */
interface BaseProps {
    children?: ReactNode;
    variant?: UiButtonVariant;
    size?: UiButtonSize;
    className?: string;
    IconLeft?: IconComponent;
    IconRight?: IconComponent;
    disabled?: boolean;
}

/**
 * Native button element
 */
export type ButtonProps = BaseProps &
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & {
        as?: 'button';
        href?: never;
    };

/**
 * Internal link using Next.js Link component (client-side navigation)
 */
export type InternalLinkProps = BaseProps &
    Omit<LinkProps, keyof BaseProps | 'href'> & {
        as: 'link';
        href: LinkProps['href'];
    };

/**
 * Native anchor element — developer controls target/rel explicitly
 */
export type AnchorProps = BaseProps &
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps> & {
        as: 'a';
        href: string;
    };

export type UiButtonProps = ButtonProps | InternalLinkProps | AnchorProps;
