import type { Metadata } from "next";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("common.settings") };
}

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getT();
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 md:px-10 md:py-12">
      <h1 className="mb-8 text-[28px] font-semibold leading-tight tracking-tight text-ink">{t("common.settings")}</h1>
      <div className="flex flex-col gap-8 md:flex-row md:gap-12">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
