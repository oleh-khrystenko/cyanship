import { getImageProps } from 'next/image';
import heroShipDarkTall from '../../../../public/images/hero/ship-dark-tall.webp';
import heroShipDarkWide from '../../../../public/images/hero/ship-dark-wide.webp';
import heroShipLightTall from '../../../../public/images/hero/ship-light-tall.webp';
import heroShipLightWide from '../../../../public/images/hero/ship-light-wide.webp';
import HeroShipVideo from './HeroShipVideo';
import { WIDE_MEDIA } from './heroMedia';

// `getImageProps` yields the optimizer's srcset without the <Image> component, so the
// crop can be chosen by `<source media>` instead of CSS. A CSS-hidden <Image> still
// downloads — and with `priority` even preloads — both crops; a `<source media>` is
// resolved by the browser, so only the matching crop is fetched, and it is re-resolved
// on rotation, which is the one moment the other crop is genuinely needed.
// Theme stays CSS-driven: `.dark` is a manual toggle, not a media query, so both
// palettes must remain in the DOM.
//
// DELIBERATE, PLEASE DON'T "FIX": the hidden palette is downloaded too. Measured
// waste is 24 KB at 828px, 38 KB at 1200px, 53 KB at 1920px — the optimizer's
// srcset keeps it to that, the source files never ship whole. Two cures have been
// weighed and rejected:
//
//   – Moving the ship to a CSS `background-image` (one rule per theme). Kills the
//     width-based srcset, because backgrounds can only branch on pixel density via
//     `image-set()`, never on viewport width. Recovering it needs width media
//     queries — the one thing this section is deliberately built without — and
//     skipping it means phones fetch the desktop rendition, losing more than the
//     24 KB saved. It also hides the LCP element's URL from the preload scanner,
//     and forces a hand-written `aspect-ratio` per theme (the light and dark wide
//     crops are 1858×846 and 1915×821), where any slip becomes layout shift.
//
//   – Collapsing both palettes into one <picture> keyed on `prefers-color-scheme`.
//     Correct on bytes, wrong on output: the still would follow the OS instead of
//     the in-app switch, so anyone who overrode the theme sees the wrong palette
//     until the video covers it — and permanently under `prefers-reduced-motion`.
const shipProps = (src: typeof heroShipLightTall, quality: number) =>
    getImageProps({
        src,
        alt: '',
        sizes: '100vw',
        quality,
        priority: true,
    }).props;

const tallLight = shipProps(heroShipLightTall, 85);
const tallDark = shipProps(heroShipDarkTall, 85);
const wideLight = shipProps(heroShipLightWide, 90);
const wideDark = shipProps(heroShipDarkWide, 90);

type ShipProps = ReturnType<typeof shipProps>;

// One component for both palettes: the markup is identical and only the crops and
// the visibility class differ, so keeping two hand-written copies would let the
// themes drift apart — and a divergence is invisible in whichever theme the author
// is currently looking at.
const HeroShipPicture = ({
    tall,
    wide,
    className,
}: {
    tall: ShipProps;
    wide: ShipProps;
    className: string;
}) => (
    <picture className={className}>
        <source
            media={WIDE_MEDIA}
            srcSet={wide.srcSet}
            sizes={wide.sizes}
            width={wide.width}
            height={wide.height}
        />
        <img {...tall} alt="" aria-hidden="true" className="h-auto w-full" />
    </picture>
);

/**
 * The ship on its own — still, loop and the seam that blends it into the copy
 * below. Held apart from any one hero because both the live home page and the
 * archived landing draw the same vessel: a second hand-written copy would let
 * the two drift, and whichever page the author is not looking at is exactly
 * where the drift would hide.
 */
const HeroShipStage = () => (
    // Full width, intrinsic height, never cropped. Which crop runs is decided
    // by viewport shape (see WIDE_MEDIA), never by a width breakpoint.
    <div className="wide:col-start-1 wide:row-start-1 wide:self-center wide:mask-fade-y relative w-full">
        <HeroShipPicture
            tall={tallLight}
            wide={wideLight}
            className="block dark:hidden"
        />

        <HeroShipPicture
            tall={tallDark}
            wide={wideDark}
            className="hidden dark:block"
        />

        <HeroShipVideo />

        {/* Seam blend into the copy below — tall composition only, where the ship hugs
            the top of the viewport and only its bottom edge meets the page. In the wide
            composition the centred ship is dissolved on both edges by `mask-fade-y`. */}
        <div className="from-background wide:hidden pointer-events-none absolute inset-x-0 bottom-0 h-1/5 bg-gradient-to-t to-transparent" />
    </div>
);

export default HeroShipStage;
