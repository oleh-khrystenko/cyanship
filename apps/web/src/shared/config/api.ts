/**
 * Same-origin path of the API. Not configurable: the refresh cookie
 * (`bid_refresh`, httpOnly) is set on the web origin, so every API call must
 * go through the proxy declared in `next.config.ts` (`/api/*` →
 * `API_INTERNAL_URL`). Pointing the browser at another origin would silently
 * break session refresh.
 */
export const API_BASE_PATH = '/api';
