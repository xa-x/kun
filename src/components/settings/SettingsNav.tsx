"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n, type MessageKey } from "@/lib/i18n";

const ITEMS: { href: string; label: MessageKey }[] = [
  { href: "/settings/profile", label: "settings.nav.profile" },
  { href: "/settings/workspace", label: "settings.nav.workspace" },
  { href: "/settings/members", label: "settings.nav.members" },
  { href: "/settings/usage", label: "settings.nav.usage" },
  { href: "/settings/privacy", label: "settings.nav.privacy" },
];

/** Sections of Settings: a column on desktop, a scrolling row on a phone. */
export function SettingsNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav aria-label={t("settings.nav.label")} className="-mx-5 overflow-x-auto px-5 md:mx-0 md:w-[200px] md:shrink-0 md:overflow-visible md:px-0">
      <ul className="flex gap-1 md:flex-col">
        {ITEMS.map((i) => {
          const active = pathname.startsWith(i.href);
          return (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center whitespace-nowrap rounded-xl px-3.5 text-[13.5px] transition-colors ${
                  active ? "bg-ink/[0.08] font-medium text-ink" : "text-muted hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {t(i.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
