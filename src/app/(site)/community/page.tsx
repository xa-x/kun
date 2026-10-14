import type { Metadata } from "next";
import { CommunityView } from "@/components/community/CommunityView";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("shell.nav.community"), description: t("shell.community.metaDescription") };
}

export default function CommunityPage() {
  return <CommunityView />;
}
