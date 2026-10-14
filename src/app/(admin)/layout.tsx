import Link from "next/link";
import { requirePageActor } from "@/lib/guard";
import { isPlatformAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { APP_HOME } from "@/lib/routes";

/**
 * Operator console, gated to ADMIN_EMAILS, with its own frame (not the
 * customer app shell). The proxy only requires a session cookie; this layout
 * is the authorization check, and every /api/admin route repeats it.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  if (!isPlatformAdmin(actor.user.email)) {
    return (
      <main dir="ltr" lang="en" className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-16 text-center">
        <p className="text-[13px] font-medium text-faint">403</p>
        <h1 className="mt-2 text-[22px] font-semibold text-ink">Admin access required</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          This console is restricted to platform admins. If you run this instance, add your email to ADMIN_EMAILS.
        </p>
        <Link href={APP_HOME} className="kun-btn-secondary mx-auto mt-6 inline-flex h-10 items-center rounded-full px-5 text-[13px] font-medium">
          Back to the app
        </Link>
      </main>
    );
  }
  return <AdminShell email={actor.user.email}>{children}</AdminShell>;
}
