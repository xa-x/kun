"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";
import { Wordmark } from "../Wordmark";
import { fetchSessionInfo } from "@/lib/session-info";
import { APP_HOME, SIGN_IN, SIGN_UP } from "@/lib/routes";
import { SIGNUP_OPEN } from "@/lib/signup-mode";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { LanguageSwitcher } from "../LanguageSwitcher";

const LINKS: { href: string; label: MessageKey }[] = [
  { href: "/#how", label: "site.nav.how" },
  { href: "/community", label: "site.nav.community" },
  { href: "/pricing", label: "site.nav.pricing" },
];

/**
 * Marketing header. Pass `signedIn` when the server already knows the answer;
 * the static landing page leaves it undefined and asks the session endpoint.
 */
export function SiteHeader({ signedIn }: { signedIn?: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  // Open only for the page it was opened on, so navigating closes the menu.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    setOpenFor(value ? pathname : null);
  };
  const [fetched, setFetched] = useState<boolean | null>(null);
  // The divider only appears once content scrolls under the header.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenFor(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (signedIn !== undefined) return;
    let alive = true;
    void fetchSessionInfo().then((s) => alive && setFetched(!!s.user));
    return () => {
      alive = false;
    };
  }, [signedIn]);

  const known = signedIn ?? fetched;

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-[background-color,border-color] duration-200 ${
        scrolled || open
          ? "border-line/70 bg-canvas/85"
          : "border-transparent bg-canvas/40"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-8 px-5 md:px-8">
        <Link href="/" aria-label={t("site.nav.home")} className="shrink-0">
          <Wordmark />
        </Link>

        <nav aria-label={t("site.nav.primary")} className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active =
              !l.href.includes("#") && pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 text-[13.5px] transition-colors ${
                  active
                    ? "bg-ink/[0.08] text-ink"
                    : "text-muted hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {t(l.label)}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          <Actions known={known} />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t("site.nav.closeMenu") : t("site.nav.openMenu")}
          className="ms-auto flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink md:hidden"
        >
          {open ? (
            <X size={18} weight="bold" aria-hidden />
          ) : (
            <List size={18} weight="bold" aria-hidden />
          )}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="kun-pop border-t border-line/60 bg-canvas px-5 pb-5 pt-3 md:hidden">
          <nav aria-label={t("site.nav.mobile")} className="flex flex-col">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl px-3 py-3 text-[15px] text-ink hover:bg-ink/5"
              >
                {t(l.label)}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            <LanguageSwitcher className="!w-full" />
            <Actions known={known} stacked />
          </div>
        </div>
      )}
    </header>
  );
}

function Actions({
  known,
  stacked = false,
}: {
  known: boolean | null;
  stacked?: boolean;
}) {
  const { t } = useI18n();
  const size = stacked ? "h-11 text-[14px]" : "h-10 text-[13.5px]";
  const base = `inline-flex items-center justify-center rounded-full px-5 font-medium ${size}`;

  // Reserve the space while the session is unknown so the header never jumps.
  if (known === null) return <span className={`${base} invisible`}>{t("common.signIn")}</span>;

  if (known) {
    return (
      <Link href={APP_HOME} className={`kun-btn-primary ${base}`}>
        {t("site.nav.openProjects")}
      </Link>
    );
  }
  return (
    <>
      {SIGNUP_OPEN && (
        <Link
          href={SIGN_IN}
          className={`${base} text-muted transition-colors hover:text-ink`}
        >
          {t("common.signIn")}
        </Link>
      )}
      <Link
        href={SIGNUP_OPEN ? SIGN_UP : SIGN_IN}
        className={`kun-btn-primary ${base}`}
      >
        {SIGNUP_OPEN ? t("site.nav.getStarted") : t("common.signIn")}
      </Link>
    </>
  );
}
