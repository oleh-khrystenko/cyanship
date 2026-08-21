'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

import { HERO_VIDEO_BASE_URL } from '@/shared/config/env';

import { WIDE_MEDIA } from './heroMedia';

const REDUCED_MOTION_MEDIA = '(prefers-reduced-motion: reduce)';

/**
 * RFC 6381 strings, read off the encoded bitstreams rather than guessed. They
 * differ per crop because the levels do: the 21:9 frame is 2520×1080, past the
 * 2 359 296-pixel ceiling of AV1 level 4.0 and H.264 level 4.0. Getting one
 * wrong fails silently — the browser skips that `<source>` without falling
 * through to an error, and a viewer just sees no motion at all.
 */
const CODECS = {
    tall: { av1: 'av01.0.08M.08', h264: 'avc1.640028' },
    wide: { av1: 'av01.0.12M.08', h264: 'avc1.640032' },
} as const;

type Crop = keyof typeof CODECS;

/**
 * The ship loop that sits on top of the hero still.
 *
 * The crop cannot be chosen declaratively the way the still does it: `<source
 * media>` is honoured inside `<picture>` but ignored inside `<video>`, so the
 * viewport shape is resolved here instead. Keeping it in one element rather
 * than four CSS-gated ones matters — a hidden `<video>` is not reliably
 * exempt from fetching its source across browsers.
 *
 * Rendering nothing is always a valid outcome: before hydration, when the
 * viewer asked the OS for no animation, when the bucket path is unset, and
 * when a crop has not been shot yet — in every case the still underneath is a
 * finished picture on its own, so a missing file degrades to a static hero
 * instead of a hole.
 */
const HeroShipVideo = () => {
    const { resolvedTheme } = useTheme();
    const [crop, setCrop] = useState<Crop | null>(null);
    const [motionAllowed, setMotionAllowed] = useState(false);

    useEffect(() => {
        const shape = window.matchMedia(WIDE_MEDIA);
        const reduced = window.matchMedia(REDUCED_MOTION_MEDIA);

        const sync = () => {
            setCrop(shape.matches ? 'wide' : 'tall');
            setMotionAllowed(!reduced.matches);
        };

        sync();
        shape.addEventListener('change', sync);
        reduced.addEventListener('change', sync);

        return () => {
            shape.removeEventListener('change', sync);
            reduced.removeEventListener('change', sync);
        };
    }, []);

    if (!HERO_VIDEO_BASE_URL || !crop || !motionAllowed || !resolvedTheme) {
        return null;
    }

    const name = `ship-${resolvedTheme === 'dark' ? 'dark' : 'light'}-${crop}`;
    const codecs = CODECS[crop];

    return (
        // `key` remounts the element when the crop or the theme changes —
        // swapping `<source>` children of a live <video> is ignored otherwise.
        <video
            key={name}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="none"
            aria-hidden="true"
            tabIndex={-1}
        >
            <source
                src={`${HERO_VIDEO_BASE_URL}/${name}.av1.mp4`}
                type={`video/mp4; codecs="${codecs.av1}"`}
            />
            <source
                src={`${HERO_VIDEO_BASE_URL}/${name}.h264.mp4`}
                type={`video/mp4; codecs="${codecs.h264}"`}
            />
        </video>
    );
};

export default HeroShipVideo;
