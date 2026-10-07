import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { resolveActor, type Actor } from "./auth";
import { signInHref } from "./routes";

/**
 * The validated session for this request, memoised so nested layouts and the
 * page share a single Supabase round trip. Null means "not signed in" (no
 * session, expired session, or auth not configured).
 *
 * `connection()` makes any render that asks "who is this?" dynamic. Without it
 * a build that happens to have no Supabase env would prerender the
 * signed-out answer into pages like /templates and serve it to everyone.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  await connection();
  return resolveActor();
});

/**
 * Server guard for workspace pages. Signed-out (or stale-cookie) visitors are
 * sent to sign-in with their destination preserved.
 */
export async function requirePageActor(): Promise<Actor> {
  const actor = await getActor();
  if (actor) return actor;
  const h = await headers();
  redirect(signInHref(h.get("x-kun-next")));
}
