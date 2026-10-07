"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";
import { Wordmark } from "../Wordmark";
import { fetchSessionInfo } from "@/lib/session-info";
import { APP_HOME, SIGN_IN, SIGN_UP } from "@/lib/routes";
import { SIGNUP_OPEN } from "@/lib/signup-mode";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/templates", label: "Templates" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * Marketing header. Pass `signedIn` when the server already knows the answer;
 * the static landing page leaves it undefined and asks the session endpoint.
 */
export function SiteHeader({ signedIn }: { signedIn?: boolean }) {
  const pathname = usePathname();
  // Open only for the page it was opened on, so navigating closes the menu.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    setOpenFor(value ? pathname : null);
  };
  const [fetched, setFetched] = useState<boolean | null>(null);

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
    <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-8 px-5 md:px-8">
        <Link href="/" aria-label="Kun home" className="shrink-0">
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
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
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Actions known={known} />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink md:hidden"
        >
          {open ? (
            <X size={18} weight="bold" aria-hidden />
          ) : (
            <List size={18} weight="bold" aria-hidden />
          )}
        </button>
      </div>

      {open && (
        <div className="kun-pop border-t border-line/60 bg-canvas px-5 pb-5 pt-3 md:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl px-3 py-3 text-[15px] text-ink hover:bg-ink/5"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
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
  const size = stacked ? "h-11 text-[14px]" : "h-10 text-[13.5px]";
  const base = `inline-flex items-center justify-center rounded-full px-5 font-medium ${size}`;

  // Reserve the space while the session is unknown so the header never jumps.
  if (known === null) return <span className={`${base} invisible`}>Sign in</span>;

  if (known) {
    return (
      <Link href={APP_HOME} className={`kun-btn-primary ${base}`}>
        Open workbooks
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
          Sign in
        </Link>
      )}
      <Link
        href={SIGNUP_OPEN ? SIGN_UP : SIGN_IN}
        className={`kun-btn-primary ${base}`}
      >
        {SIGNUP_OPEN ? "Get started" : "Sign in"}
      </Link>
    </>
  );
}
