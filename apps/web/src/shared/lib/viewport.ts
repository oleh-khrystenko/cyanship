/**
 * Viewport width at which overlays switch from mobile (bottom sheet) to desktop
 * layout. Mirrors the Tailwind `md` breakpoint used by UiModal / UiSheet.
 */
export const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

/**
 * True when the viewport is at least `md` wide.
 * SSR-safe: returns `false` when `window` is unavailable.
 */
export function isDesktopViewport(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}
