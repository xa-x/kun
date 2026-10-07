import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/guard";
import { APP_HOME } from "@/lib/routes";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getActor()) redirect(APP_HOME);
  return <SignUpForm />;
}
