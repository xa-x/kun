/**
 * Route map shared by the proxy, server guards and client components.
 * Kept free of server-only imports so the proxy and the browser can use it.
 */
export const HOME = "/";
export const APP_HOME = "/workbooks";
export const SIGN_IN = "/sign-in";
export const SIGN_UP = "/sign-up";

/** Pages that only exist for signed-out visitors. */
const AUTH_PATHS = new Set([SIGN_IN, SIGN_UP]);

/**
 * Validates a post-auth destination. Only same-origin paths are allowed, and
 * destinations that would bounce straight back (auth pages, the landing page,
 * API routes) fall back to the app home.
 */
export function safeNext(
  raw: string | null | undefined,
  fallback: string = APP_HOME,
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  const path = raw.split(/[?#]/)[0];
  if (path === HOME || AUTH_PATHS.has(path) || path.startsWith("/api/")) {
    return fallback;
  }
  return raw;
}

/** Sign-in URL that returns the visitor to `next` afterwards. */
export function signInHref(next?: string | null): string {
  const safe = safeNext(next, "");
  if (!safe || safe === APP_HOME) return SIGN_IN;
  return `${SIGN_IN}?next=${encodeURIComponent(safe)}`;
}
