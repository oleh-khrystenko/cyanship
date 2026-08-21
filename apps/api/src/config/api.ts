/**
 * Global route prefix applied in `main.ts`. Mirrored on the web side by
 * `API_BASE_PATH` (`apps/web/src/shared/config/api.ts`) and by the
 * `/api/:path*` rewrite in `next.config.ts`: the browser always reaches this
 * service through `WEB_URL/api`, never on its own origin.
 */
export const API_GLOBAL_PREFIX = 'api';
