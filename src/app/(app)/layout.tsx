import { redirect } from "next/navigation";
import { resolveActor } from "@/lib/auth";

/**
 * Workspace routes (/, /w/*, /runs, /billing). The proxy does a cheap
 * cookie-presence check for fast redirects; this layout is the real
 * server-side guard — no valid session, no render.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await resolveActor();
  if (!actor) redirect("/sign-in");
  return <>{children}</>;
}
