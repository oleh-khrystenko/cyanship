import Link from 'next/link';
import { Ref, forwardRef } from 'react';
import { composeClasses } from '@/shared/lib/utils';
import type { UiLinkProps, UiLinkVariant } from './types';

const variantStyles: Record<UiLinkVariant, string> = {
    primary: 'text-primary hover:underline transition-colors',
    'primary-underline':
        'text-primary underline hover:no-underline transition-colors',
    muted: 'text-muted-foreground hover:text-foreground transition-colors',
    subtle: 'underline decoration-muted-foreground/30 underline-offset-4 transition-colors hover:text-muted-foreground',
};

const UiLink = forwardRef<HTMLAnchorElement, UiLinkProps>((props, ref) => {
    const { children, className, variant = 'primary' } = props;

    const classes = composeClasses(variantStyles[variant], className);

    if (props.as === 'link') {
        const {
            as: _as,
            href,
            variant: _variant,
            className: _className,
            children: _children,
            ...linkProps
        } = props;

        return (
            <Link
                {...linkProps}
                href={href}
                className={classes}
                ref={ref}
            >
                {children}
            </Link>
        );
    }

    const {
        as: _as,
        href,
        variant: _variant,
        className: _className,
        children: _children,
        ...anchorProps
    } = props;

    return (
        <a
            {...anchorProps}
            href={href}
            className={classes}
            ref={ref as Ref<HTMLAnchorElement>}
        >
            {children}
        </a>
    );
});

UiLink.displayName = 'UiLink';

export default UiLink;
