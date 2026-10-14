import type { Metadata } from "next";
import { requirePageActor } from "@/lib/guard";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("editor.meta.title") };
}

/**
 * The canvas editor owns the whole viewport, so it sits outside the workspace
 * shell. It shares the same session guard.
 */
export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageActor();
  return <>{children}</>;
}
