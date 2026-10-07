import { requirePageActor } from "@/lib/guard";
import { isPlatformAdmin } from "@/lib/admin";
import { AppShell } from "@/components/shell/AppShell";

/**
 * Workspace routes (/workbooks, /runs, /billing). The proxy only checks that a
 * session cookie exists so signed-out visitors redirect fast; this layout is
 * the real guard. No valid session, no render.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requirePageActor();
  return (
    <AppShell
      user={{
        name: actor.user.name,
        email: actor.user.email,
        plan: actor.org.plan,
        isAdmin: isPlatformAdmin(actor.user.email),
      }}
    >
      {children}
    </AppShell>
  );
}
