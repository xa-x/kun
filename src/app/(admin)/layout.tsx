import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveActor } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { Wordmark } from "@/components/Wordmark";

/**
 * Platform control plane — gated to ADMIN_EMAILS. The proxy bounces
 * signed-out visitors to /sign-in; this layout is the authorization check.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await resolveActor();
  if (!actor) redirect("/sign-in?next=%2Fadmin");
  if (!isPlatformAdmin(actor.user.email)) {
    return (
      <div className="kun-atmosphere relative flex min-h-dvh flex-col">
        <div className="kun-grain" aria-hidden />
        <main className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-16 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
            403
          </p>
          <h1 className="mt-2 text-[22px] font-semibold text-ink">
            Admin access required
          </h1>
          <p className="mt-2 text-[13px] text-muted">
            This console is restricted to platform admins. If you run this
            instance, add your email to ADMIN_EMAILS.
          </p>
          <Link
            href="/"
            className="mt-6 text-[13px] text-muted transition-colors hover:text-ink"
          >
            Back to the app
          </Link>
        </main>
      </div>
    );
  }
  return (
    <div className="kun-atmosphere relative flex min-h-dvh flex-col">
      <div className="kun-grain" aria-hidden />
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-4 border-b border-line/80 px-5">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>
        <span className="rounded-full bg-white/[0.06] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
          Admin
        </span>
        <Link
          href="/"
          className="ml-auto text-[12.5px] text-muted transition-colors hover:text-ink"
        >
          Back to app
        </Link>
      </header>
      <main className="relative z-10 flex-1">{children}</main>
    </div>
  );
}
