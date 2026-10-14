import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("settings.pricing.metaTitle"), description: t("settings.pricing.metaDesc") };
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
