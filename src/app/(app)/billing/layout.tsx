import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("settings.billing.metaTitle") };
}

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
