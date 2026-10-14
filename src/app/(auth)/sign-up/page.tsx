import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/guard";
import { APP_HOME } from "@/lib/routes";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { getT } from "@/lib/i18n/server";
import { platform } from "@/lib/platform";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("site.meta.signUp") };
}

export default async function SignUpPage() {
  if (await getActor()) redirect(APP_HOME);
  const { signupOpen } = await platform();
  return <SignUpForm closed={!signupOpen} />;
}
