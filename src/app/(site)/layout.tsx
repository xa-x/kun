import { getActor } from "@/lib/guard";
import { isPlatformAdmin } from "@/lib/admin";
import { AppShell } from "@/components/shell/AppShell";
import { MarketingShell } from "@/components/marketing/MarketingShell";

/**
 * Pages anyone can open (templates, pricing) that adapt to the visitor:
 * signed-in members get them inside the workspace shell, so the sidebar never
 * disappears; everyone else gets the marketing chrome. The share viewer
 * (/s/[token]) deliberately stays outside this group because it is a
 * standalone full-bleed page.
 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A public page should still render if the session lookup fails.
  const actor = await getActor().catch(() => null);

  if (actor) {
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
  return <MarketingShell signedIn={false}>{children}</MarketingShell>;
}
