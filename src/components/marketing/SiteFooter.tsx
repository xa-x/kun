import Link from "next/link";
import { Wordmark } from "../Wordmark";
import { ThemeToggle } from "./ThemeToggle";
import { SIGN_IN } from "@/lib/routes";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/templates", label: "Templates" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Account",
    links: [{ href: SIGN_IN, label: "Sign in" }],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-line/70">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-5 py-12 md:flex-row md:justify-between md:px-8">
        <div className="max-w-xs">
          <Wordmark />
          <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
            كُن means “Be!”. The word that makes something exist, for a canvas
            that turns a sentence into a running pipeline.
          </p>
        </div>

        <div className="flex gap-16">
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="text-[13px] font-medium text-ink">{c.title}</p>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[13.5px] text-muted transition-colors hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 border-t border-line/60 px-5 py-5 md:px-8">
        <p className="text-[12.5px] text-faint">© 2026 Kun</p>
        <ThemeToggle />
      </div>
    </footer>
  );
}
