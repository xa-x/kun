import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight auth gate (Next 16 proxy convention — middleware is renamed).
 * Checks only for the presence of a Supabase session cookie; actual token
 * validation happens server-side in requireActor() on every API call and in
 * the (app)/(admin) group layouts.
 *
 * Public by design (never matched here): /api/*, /templates, /pricing,
 * /s/[token], and everything under /public + /_next.
 */
const SB_SESSION = /^sb-.*-auth-token(\.\d+)?$/;
const AUTH_PAGES = new Set(["/sign-in", "/sign-up"]);

function hasSessionCookie(req: NextRequest) {
  return req.cookies.getAll().some((c) => SB_SESSION.test(c.name));
}

export function proxy(req: NextRequest) {
  const authed = hasSessionCookie(req);
  const { pathname, search } = req.nextUrl;

  if (AUTH_PAGES.has(pathname)) {
    if (authed) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Workspace + admin pages only; auth pages are matched to bounce
  // signed-in users back to the app.
  matcher: [
    "/",
    "/w/:path*",
    "/runs/:path*",
    "/billing/:path*",
    "/admin/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
