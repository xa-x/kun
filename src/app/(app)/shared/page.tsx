import type { Metadata } from "next";
import { SharedView } from "@/components/SharedView";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("shell.nav.shared") };
}

export default function SharedPage() {
  return <SharedView />;
}
