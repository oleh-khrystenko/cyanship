'use client';

import {
    KeyboardEvent,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useTranslations } from 'next-intl';
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll from 'embla-carousel-auto-scroll';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import UiButton from '@/shared/ui/UiButton';
import { PORTFOLIO_ITEM_TYPE, PORTFOLIO_ITEMS } from './cases';
import PortfolioComparisonCard from './PortfolioComparisonCard';
import PortfolioWorkCard from './PortfolioWorkCard';
import { usePortfolioCaseStore } from './portfolioCaseStore';

const REDUCED_MOTION_MEDIA = '(prefers-reduced-motion: reduce)';

/** 24px per second, written in the per-frame steps the plugin counts in. */
const SCROLL_SPEED = 24 / 60;

/**
 * ~250ms per card. Embla measures this in its own 1/60s steps and takes no CSS
 * variable, so this is the one duration in the codebase that lives in TS.
 */
const SCROLL_DURATION = 15;

const SLIDE_SELECTOR = '[data-portfolio-slide]';

/** Minimum comfortable tap area — see `docs/conventions/responsive.md`. */
const TOUCH_TARGET = 'min-h-11 min-w-11';

/**
 * The work reel: a full-bleed strip that crawls on its own.
 *
 * The strip runs edge to edge while the cards line up under the heading — Embla
 * treats the viewport width as the visible width, so a narrower viewport would
 * leave the far side of the loop uncovered on every pass.
 */
const PortfolioCarousel = () => {
    const t = useTranslations('portfolio');

    const contentEdgeRef = useRef<HTMLDivElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);

    const [isUserPaused, setIsUserPaused] = useState(false);
    /**
     * `null` until the media query has been read. The preference cannot be
     * read during render — the server has no `window`, and guessing would
     * either desync hydration or let the strip lurch for one frame before the
     * first effect corrects it.
     */
    const [systemMotionAllowed, setSystemMotionAllowed] = useState<
        boolean | null
    >(null);
    /**
     * The same flag as the state, kept for the button handlers: they have to
     * tell a pause the viewer asked for from one the operating system asked
     * for, and they read it outside of a render.
     */
    const isSystemPausedRef = useRef(false);
    const [passCount, setPassCount] = useState(1);

    const isStopped = isUserPaused || systemMotionAllowed === false;

    /**
     * Where the content column starts, measured rather than repeated as a
     * number: the container width lives in a class, and a second copy of it
     * here would drift apart from the first the day either changes.
     */
    const alignToContentEdge = useCallback(() => {
        const node = contentEdgeRef.current;
        if (!node) return 0;

        const paddingLeft = Number.parseFloat(
            window.getComputedStyle(node).paddingLeft
        );

        return (
            node.getBoundingClientRect().left +
            (Number.isNaN(paddingLeft) ? 0 : paddingLeft)
        );
    }, []);

    const options = useMemo(
        () => ({
            align: alignToContentEdge,
            loop: true,
            duration: SCROLL_DURATION,
            // A strip pushed by hand stays where it was let go instead of
            // snapping back; the buttons still land on snap points.
            dragFree: true,
        }),
        [alignToContentEdge]
    );

    // Every automatic stop is off on purpose: each one would restart the crawl
    // somewhere the viewer had deliberately paused it. The effects below own
    // starting and stopping instead.
    const plugins = useMemo(
        () => [
            AutoScroll({
                speed: SCROLL_SPEED,
                startDelay: 0,
                playOnInit: false,
                stopOnInteraction: true,
                stopOnFocusIn: false,
                stopOnMouseEnter: false,
            }),
            WheelGesturesPlugin(),
        ],
        []
    );

    const [emblaRef, emblaApi] = useEmblaCarousel(options, plugins);

    // The case dialog is mounted globally in `app/overlays.tsx` and outlives
    // the page, so a case left open would still be sitting over whatever the
    // visitor reached next — a back button press, a footer link. The reel is
    // the one part of the section that is always mounted with it, so dropping
    // the open case here closes the dialog with the section it belongs to.
    useEffect(() => () => usePortfolioCaseStore.getState().close(), []);

    const setViewportNode = useCallback(
        (node: HTMLDivElement | null) => {
            viewportRef.current = node;
            emblaRef(node);
        },
        [emblaRef]
    );

    useEffect(() => {
        const reduced = window.matchMedia(REDUCED_MOTION_MEDIA);

        const sync = () => {
            isSystemPausedRef.current = reduced.matches;
            setSystemMotionAllowed(!reduced.matches);
        };

        sync();
        reduced.addEventListener('change', sync);

        return () => reduced.removeEventListener('change', sync);
    }, []);

    useEffect(() => {
        const autoScroll = emblaApi?.plugins()?.autoScroll;
        if (!emblaApi || !autoScroll || systemMotionAllowed === null) return;

        const sync = () => {
            if (isStopped) autoScroll.stop();
            else autoScroll.play();
        };

        sync();
        // A resize rebuilds the plugins, and a strip that was crawling would
        // come back stopped without this.
        emblaApi.on('reInit', sync);

        return () => {
            emblaApi.off('reInit', sync);
        };
    }, [emblaApi, isStopped, systemMotionAllowed]);

    useEffect(() => {
        if (isStopped) return;

        const autoScroll = emblaApi?.plugins()?.autoScroll;
        if (!emblaApi || !autoScroll) return;

        // A button press or a drag hands the track to the ordinary scroll body;
        // the crawl picks it back up once that has settled.
        const resume = () => {
            if (!autoScroll.isPlaying()) autoScroll.play();
        };

        emblaApi.on('settle', resume);

        return () => {
            emblaApi.off('settle', resume);
        };
    }, [emblaApi, isStopped]);

    /**
     * Embla keeps a loop only while the slides are wider than the viewport,
     * and silently drops it once they are not — on a wide monitor the crawl
     * would die on the last card. Laying the set out several times over fixes
     * that, and the step is measured off the DOM because the card widths live
     * in classes and change at two breakpoints.
     */
    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const measure = () => {
            const [first, second] = Array.from(
                viewport.querySelectorAll(SLIDE_SELECTOR)
            );

            if (
                !(first instanceof HTMLElement) ||
                !(second instanceof HTMLElement)
            ) {
                return;
            }

            // Layout offsets, so the track's own transform stays out of it.
            const step = second.offsetLeft - first.offsetLeft;
            if (step <= 0) return;

            setPassCount(
                Math.max(
                    1,
                    Math.ceil(
                        (viewport.clientWidth + step) /
                            (step * PORTFOLIO_ITEMS.length)
                    )
                )
            );
        };

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(viewport);

        return () => observer.disconnect();
    }, []);

    const scrollBy = useCallback(
        (direction: -1 | 1) => {
            if (!emblaApi) return;

            // While the crawl plays it owns the scroll body and rewrites the
            // target every frame, so a press would do nothing.
            emblaApi.plugins()?.autoScroll?.stop();

            const jump = isSystemPausedRef.current;
            if (direction === -1) emblaApi.scrollPrev(jump);
            else emblaApi.scrollNext(jump);
        },
        [emblaApi]
    );

    const toggleMotion = useCallback(() => {
        if (!isStopped) {
            setIsUserPaused(true);
            return;
        }

        // Asking for motion by hand overrides the system preference, so the
        // buttons animate normally from here on.
        isSystemPausedRef.current = false;
        setSystemMotionAllowed(true);
        setIsUserPaused(false);
    }, [isStopped]);

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        // Only when the strip itself holds focus. The handler sits on the
        // scroll container, so a press anywhere inside bubbles up to it — and
        // cancelling the default here would cancel it for the element that was
        // actually pressed. The before/after handle is a range input, which
        // moves on the very same two keys; left to bubble, the arrows would
        // scroll the strip instead of the slider, and the slider would sit
        // still with no sign of why.
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

        event.preventDefault();
        scrollBy(event.key === 'ArrowLeft' ? -1 : 1);
    };

    const passes = Array.from({ length: passCount }, (_, index) => index);

    return (
        <>
            <div
                ref={contentEdgeRef}
                className="container mt-10 flex justify-end gap-2 px-6"
            >
                {/* `UiButton` sizes by padding alone, so an icon-only button
                    lands short of the 44×44 a thumb needs. The reel is read on
                    a phone before anywhere else, so the floor is set here. */}
                <UiButton
                    variant="soft"
                    size="md"
                    aria-label={t('previous')}
                    IconLeft={<ChevronLeft />}
                    className={TOUCH_TARGET}
                    onClick={() => scrollBy(-1)}
                />
                <UiButton
                    variant="soft"
                    size="md"
                    aria-label={t('next')}
                    IconLeft={<ChevronRight />}
                    className={TOUCH_TARGET}
                    onClick={() => scrollBy(1)}
                />
                <UiButton
                    variant="soft"
                    size="md"
                    aria-label={isStopped ? t('resume') : t('pause')}
                    IconLeft={isStopped ? <Play /> : <Pause />}
                    className={TOUCH_TARGET}
                    onClick={toggleMotion}
                />
            </div>

            <div
                ref={setViewportNode}
                role="region"
                aria-label={t('reel_label')}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                className="focus-visible:ring-ring mt-8 cursor-grab touch-pan-y touch-pinch-zoom overflow-hidden focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
            >
                <div className="flex">
                    {passes.map((pass) =>
                        PORTFOLIO_ITEMS.map((item) => (
                            <div
                                key={`${pass}-${item.slug}`}
                                data-portfolio-slide
                                // The gap sits on the slide, not on the track:
                                // Embla measures the loop by the slides, and a
                                // track gap would leave the seam between last
                                // and first one gap short — permanently visible
                                // on a strip that never stops.
                                className="mr-4 flex w-72 shrink-0 sm:w-80 md:mr-6 lg:w-96"
                                // A copy is hidden from assistive tech and taken
                                // out of the tab order, but stays clickable: the
                                // strip shows copies as readily as originals, and
                                // a card that ignores a tap reads as a broken
                                // site on the one section meant to prove the
                                // opposite.
                                aria-hidden={pass > 0}
                            >
                                {item.type ===
                                PORTFOLIO_ITEM_TYPE.COMPARISON ? (
                                    <PortfolioComparisonCard
                                        slug={item.slug}
                                        beforeSrc={item.beforeSrc}
                                        afterSrc={item.afterSrc}
                                        duplicate={pass > 0}
                                    />
                                ) : (
                                    <PortfolioWorkCard
                                        slug={item.slug}
                                        screens={item.screens}
                                        duplicate={pass > 0}
                                    />
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};

export default PortfolioCarousel;
