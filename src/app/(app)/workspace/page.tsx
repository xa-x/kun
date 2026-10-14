import type { Metadata } from "next";
import { HomeGallery } from "@/components/HomeGallery";
import { requirePageActor } from "@/lib/guard";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("shell.nav.workspace") };
}

export default async function WorkspacePage() {
  const actor = await requirePageActor();
  return (
    <HomeGallery
      name={actor.user.name}
      workspace={{ id: actor.org.id, name: actor.org.name }}
    />
  );
}
