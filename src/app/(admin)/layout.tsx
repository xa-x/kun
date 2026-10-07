import Link from "next/link";
import { requirePageActor } from "@/lib/guard";
import { isPlatformAdmin } from "@/lib/admin";
import { AppShell } from "@/components/shell/AppShell";
import { APP_HOME } from "@/lib/routes";

/**
 * Platform control plane, gated to ADMIN_EMAILS. The proxy only requires a
 * session cookie; this layout is the authorization check.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requirePageActor();
  const isAdmin = isPlatformAdmin(actor.user.email);

  return (
    <AppShell
      user={{
        name: actor.user.name,
        email: actor.user.email,
        plan: actor.org.plan,
        isAdmin,
      }}
    >
      {isAdmin ? (
        children
      ) : (
        <div className="mx-auto flex min-h-[70dvh] w-full max-w-sm flex-col justify-center px-5 py-16 text-center">
          <p className="text-[13px] font-medium text-faint">403</p>
          <h1 className="mt-2 text-[22px] font-semibold text-ink">
            Admin access required
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            This console is restricted to platform admins. If you run this
            instance, add your email to ADMIN_EMAILS.
          </p>
          <Link
            href={APP_HOME}
            className="kun-btn-secondary mx-auto mt-6 inline-flex h-10 items-center rounded-full px-5 text-[13px] font-medium"
          >
            Back to workbooks
          </Link>
        </div>
      )}
    </AppShell>
  );
}
