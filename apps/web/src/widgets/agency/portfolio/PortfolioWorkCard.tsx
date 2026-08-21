'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import UiButton from '@/shared/ui/UiButton';
import {
    PORTFOLIO_CARD_SIZES,
    PORTFOLIO_IMAGE_HEIGHT,
    PORTFOLIO_IMAGE_WIDTH,
    screenSrc,
} from './cases';
import { usePortfolioCaseStore } from './portfolioCaseStore';

interface PortfolioWorkCardProps {
    slug: string;
    screens: number;
    /**
     * A repeat of the same card, laid out to keep the strip looping on a wide
     * monitor. It opens the very case its original does, so it stays clickable
     * — only the keyboard skips it, because stopping on the same case several
     * times over is noise, not navigation.
     */
    duplicate?: boolean;
}

/**
 * The cover is the only screen this card downloads; the rest are fetched when
 * the case is opened. One image per card instead of every screen of every case
 * is the difference between a section that loads and one that argues against
 * the offer it is there to prove.
 */
const PortfolioWorkCard = ({
    slug,
    screens,
    duplicate = false,
}: PortfolioWorkCardProps) => {
    const t = useTranslations('portfolio');
    const open = usePortfolioCaseStore((s) => s.open);
    const title = t(`cases.${slug}.title`);

    return (
        <article className="group border-border bg-card relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border">
            <div className="bg-secondary overflow-hidden">
                <Image
                    src={screenSrc(slug, 1)}
                    alt={title}
                    width={PORTFOLIO_IMAGE_WIDTH}
                    height={PORTFOLIO_IMAGE_HEIGHT}
                    sizes={PORTFOLIO_CARD_SIZES}
                    className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]"
                />
            </div>

            <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl font-semibold tracking-tight">
                    {title}
                </h3>
                <p className="text-muted-foreground mt-3 leading-relaxed">
                    {t(`cases.${slug}.summary`)}
                </p>
                {/* Pinned to the bottom so the row lands on the same line on
                    every card, whatever the summary above it runs to.

                    The button is a span, not a `UiButton`: the whole card is
                    already one button (below), and a real one nested under it
                    would be a second focus stop for the same action. It looks
                    like the soft variant because that is what it stands in for
                    — on touch there is no cursor and no hover, so a card needs
                    something that reads as pressable at a glance. */}
                <div className="text-muted-foreground mt-auto flex items-center justify-between gap-4 pt-5 text-sm">
                    <span
                        className="border-border group-hover:bg-muted group-hover:text-foreground inline-flex items-center rounded-lg border px-3 py-1.5 font-medium transition-colors"
                        aria-hidden="true"
                    >
                        {t('open')}
                    </span>
                    <span>{t('screens', { count: screens })}</span>
                </div>
            </div>

            {/* One hit area over the whole card. The card itself stays a plain
                article: nesting the image and the copy inside a button would put
                block content inside the button's inline content wrapper. */}
            <UiButton
                variant="text"
                size="md"
                className="focus-visible:ring-ring absolute inset-0 h-full w-full rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2"
                tabIndex={duplicate ? -1 : undefined}
                onClick={() => open(slug)}
            >
                <span className="sr-only">{`${t('open')}: ${title}`}</span>
            </UiButton>
        </article>
    );
};

export default PortfolioWorkCard;
