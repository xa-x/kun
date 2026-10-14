import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/guard";
import { safeNext } from "@/lib/routes";
import { supabaseConfigured } from "@/lib/supabase";
import { SignInForm } from "@/components/auth/SignInForm";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("site.meta.signIn") };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = safeNext(next);

  // A *validated* session sends the visitor on. A stale cookie does not, which
  // is what keeps sign-in reachable (and the redirect loop gone).
  if (await getActor()) redirect(dest);

  return <SignInForm next={dest} configured={supabaseConfigured()} />;
}
