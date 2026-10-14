import Link from "next/link";
import { Wordmark } from "../Wordmark";
import { ThemeToggle } from "./ThemeToggle";
import { SIGN_IN } from "@/lib/routes";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";
import { LanguageSwitcher } from "../LanguageSwitcher";

const COLUMNS: { title: MessageKey; links: { href: string; label: MessageKey }[] }[] = [
  {
    title: "site.footer.product",
    links: [
      { href: "/#how", label: "site.nav.how" },
      { href: "/community", label: "site.nav.community" },
      { href: "/pricing", label: "site.nav.pricing" },
    ],
  },
  {
    title: "site.footer.account",
    links: [{ href: SIGN_IN, label: "common.signIn" }],
  },
];

export async function SiteFooter() {
  const { t } = await getT();
  return (
    <footer className="relative z-10 border-t border-line/70">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-5 py-12 md:flex-row md:justify-between md:px-8">
        <div className="max-w-xs">
          <Wordmark />
          <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
            {t("site.footer.blurb")}
          </p>
        </div>

        <div className="flex gap-16">
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={t(c.title)}>
              <p className="text-[13px] font-medium text-ink">{t(c.title)}</p>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[13.5px] text-muted transition-colors hover:text-ink"
                    >
                      {t(l.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 border-t border-line/60 px-5 py-5 md:px-8">
        <p className="text-[12.5px] text-faint">{t("site.footer.copyright")}</p>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
