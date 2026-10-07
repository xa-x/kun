import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/guard";
import { safeNext } from "@/lib/routes";
import { supabaseConfigured } from "@/lib/supabase";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = { title: "Sign in" };

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
