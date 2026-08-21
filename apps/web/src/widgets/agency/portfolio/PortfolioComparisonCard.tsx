'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
    PORTFOLIO_CARD_SIZES,
    PORTFOLIO_IMAGE_HEIGHT,
    PORTFOLIO_IMAGE_WIDTH,
} from './cases';

interface PortfolioComparisonCardProps {
    slug: string;
    beforeSrc: string;
    afterSrc: string;
    /** A repeat laid out to keep the strip looping — see `PortfolioWorkCard`. */
    duplicate?: boolean;
}

const INITIAL_POSITION = 50;

/**
 * The rewritten first screen laid over the one it replaces, with a handle
 * between them. The handle is a range input rather than a mouse-driven divider:
 * it drags with a pointer, steps with the arrow keys, and announces itself to a
 * screen reader — all three for free, and none of them by hand.
 */
const PortfolioComparisonCard = ({
    slug,
    beforeSrc,
    afterSrc,
    duplicate = false,
}: PortfolioComparisonCardProps) => {
    const t = useTranslations('portfolio');
    const [position, setPosition] = useState(INITIAL_POSITION);
    const inputId = useId();
    const title = t(`cases.${slug}.title`);

    return (
        <article className="border-border bg-card flex h-full flex-col overflow-hidden rounded-xl border">
            <div className="bg-secondary relative select-none">
                <Image
                    src={afterSrc}
                    alt={`${title} — ${t('after')}`}
                    width={PORTFOLIO_IMAGE_WIDTH}
                    height={PORTFOLIO_IMAGE_HEIGHT}
                    sizes={PORTFOLIO_CARD_SIZES}
                    className="h-auto w-full"
                />

                {/* The "before" state sits on top and is clipped away from the
                    right, so the slider reveals the rebuilt screen underneath. */}
                <div
                    className="absolute inset-0"
                    style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
                    aria-hidden="true"
                >
                    <Image
                        src={beforeSrc}
                        alt=""
                        width={PORTFOLIO_IMAGE_WIDTH}
                        height={PORTFOLIO_IMAGE_HEIGHT}
                        sizes={PORTFOLIO_CARD_SIZES}
                        className="h-auto w-full"
                    />
                </div>

                <div
                    className="bg-background pointer-events-none absolute inset-y-0 w-0.5"
                    style={{ left: `${position}%` }}
                    aria-hidden="true"
                />

                <label className="sr-only" htmlFor={inputId}>
                    {t('slider_label')}
                </label>
                <input
                    id={inputId}
                    type="range"
                    min={0}
                    max={100}
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                    tabIndex={duplicate ? -1 : undefined}
                    className="absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent"
                />

                <span className="text-foreground bg-background/80 absolute top-3 left-3 rounded-md px-2 py-1 text-sm font-medium">
                    {t('before')}
                </span>
                <span className="text-foreground bg-background/80 absolute top-3 right-3 rounded-md px-2 py-1 text-sm font-medium">
                    {t('after')}
                </span>
            </div>

            <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl font-semibold tracking-tight">
                    {title}
                </h3>
                <p className="text-muted-foreground mt-3 leading-relaxed">
                    {t(`cases.${slug}.summary`)}
                </p>
            </div>
        </article>
    );
};

export default PortfolioComparisonCard;
