/**
 * Must stay identical to the `wide` custom variant in shared/styles/themes.css —
 * the picture, the video and the layout have to flip on the exact same threshold,
 * otherwise the wide crop would render inside the vertical composition.
 */
export const WIDE_MEDIA = '(min-aspect-ratio: 4/5)';
