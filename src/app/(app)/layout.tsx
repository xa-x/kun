import { requirePageActor } from "@/lib/guard";
import { shellUser } from "@/lib/shell-user";
import { platform } from "@/lib/platform";
import { AppShell } from "@/components/shell/AppShell";

/**
 * Workspace routes (/workspace, /assets, /shared, /community, /runs, /billing). The proxy only checks that a
 * session cookie exists so signed-out visitors redirect fast; this layout is
 * the real guard. No valid session, no render.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requirePageActor();
  const a = (await platform()).announcement;
  const banner = a.on ? { text: a.text, level: a.level } : null;
  return (
    <AppShell user={shellUser(actor)} banner={banner}>
      {children}
    </AppShell>
  );
}
