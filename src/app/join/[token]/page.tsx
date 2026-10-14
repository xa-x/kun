import type { Metadata } from "next";
import { JoinView } from "@/components/settings/JoinView";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("shell.join.metaTitle") };
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JoinView token={token} />;
}
