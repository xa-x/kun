import { NextRequest, NextResponse } from "next/server";
import { hasSessionCookie } from "@/lib/session-cookie";
import { signInHref } from "@/lib/routes";

/**
 * Fast, optimistic gate for workspace routes (Next 16 proxy convention).
 *
 * It only answers "is there a session cookie for this project?" so signed-out
 * visitors are redirected before anything renders. It never decides that a
 * visitor is *signed in*: a cookie can be expired or revoked, so the server
 * layouts validate the session for real (see lib/guard.ts). That split is what
 * prevents redirect loops. Auth pages and the marketing pages are deliberately
 * not matched here.
 *
 * Public by design: /, /pricing, /templates, /s/[token], /sign-in, /sign-up,
 * /api/* (route handlers authenticate themselves) and static assets.
 */
export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.searchParams.delete("_rsc");
  const target = url.pathname + url.search;

  if (!hasSessionCookie(req.cookies.getAll())) {
    const [pathname, query] = signInHref(target).split("?");
    url.pathname = pathname;
    url.search = query ? `?${query}` : "";
    return NextResponse.redirect(url);
  }

  // Layouts can't read the URL; hand it over so a stale-cookie redirect can
  // still carry the visitor's destination through sign-in.
  const headers = new Headers(req.headers);
  headers.set("x-kun-next", target);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/workbooks/:path*",
    "/w/:path*",
    "/runs/:path*",
    "/billing/:path*",
    "/admin/:path*",
  ],
};
