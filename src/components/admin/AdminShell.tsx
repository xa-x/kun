"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ChartLineUp,
  ClockCountdown,
  CreditCard,
  Cpu,
  Gear,
  Globe,
  Link as LinkIcon,
  List,
  ListChecks,
  Lightning,
  ShieldCheck,
  UserPlus,
  UsersThree,
  Buildings,
  X,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Wordmark } from "../Wordmark";
import { APP_HOME } from "@/lib/routes";
import { I18nProvider } from "@/lib/i18n/client";
import { FALLBACK, MESSAGES } from "@/lib/i18n/messages";

const GROUPS: { title: string; items: { href: string; label: string; icon: Icon; exact?: boolean }[] }[] = [
  {
    title: "Monitor",
    items: [
      { href: "/admin", label: "Overview", icon: ChartLineUp, exact: true },
      { href: "/admin/runs", label: "Runs", icon: Lightning },
      { href: "/admin/queue", label: "Queue", icon: ClockCountdown },
    ],
  },
  {
    title: "Customers",
    items: [
      { href: "/admin/users", label: "Users", icon: UsersThree },
      { href: "/admin/workspaces", label: "Workspaces", icon: Buildings },
      { href: "/admin/access", label: "Access and invites", icon: UserPlus },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/community", label: "Community", icon: Globe },
      { href: "/admin/shares", label: "Share links", icon: LinkIcon },
    ],
  },
  { title: "Revenue", items: [{ href: "/admin/billing", label: "Billing and margin", icon: CreditCard }] },
  {
    title: "Platform",
    items: [
      { href: "/admin/models", label: "Models", icon: Cpu },
      { href: "/admin/settings", label: "Settings", icon: Gear },
      { href: "/admin/audit", label: "Audit log", icon: ListChecks },
    ],
  },
];

function SideNav({ email, onNavigate }: { email: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="mb-6 flex items-center justify-between px-2">
        <Link href="/admin" onClick={onNavigate} aria-label="Admin home" className="flex items-center gap-3">
          <Wordmark />
          <span className="flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-medium text-ink">
            <ShieldCheck size={11} weight="fill" aria-hidden />
            Admin
          </span>
        </Link>
      </div>
      <nav aria-label="Admin" className="flex-1 space-y-6 overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-9 items-center gap-3 rounded-xl px-3 text-[13.5px] transition-colors ${
                        active ? "bg-ink/[0.08] font-medium text-ink" : "text-muted hover:bg-ink/5 hover:text-ink"
                      }`}
                    >
                      <i.icon size={16} weight={active ? "fill" : "regular"} aria-hidden />
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="mt-4 border-t border-line pt-4">
        <p className="truncate px-3 text-[12px] text-faint" title={email}>
          {email}
        </p>
        <Link
          href={APP_HOME}
          className="mt-2 flex h-9 items-center gap-3 rounded-xl px-3 text-[13.5px] text-muted transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to the app
        </Link>
      </div>
    </div>
  );
}

/**
 * The operator console's own frame: a grouped sidebar on desktop, a drawer on
 * a phone. It is deliberately separate from the customer app shell, and
 * English and left-to-right whatever language the app is in.
 */
export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const drawer = open && openFor === pathname;

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div dir="ltr" lang="en" className="kun-atmosphere relative flex min-h-dvh text-left">
      <aside className="sticky top-0 z-20 hidden h-dvh w-[250px] shrink-0 border-r border-line/80 bg-canvas/60 backdrop-blur-xl md:block">
        <SideNav email={email} />
      </aside>
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line/80 bg-canvas/80 px-4 backdrop-blur-xl md:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => {
              setOpenFor(pathname);
              setOpen(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
          >
            <List size={18} weight="bold" aria-hidden />
          </button>
          <Wordmark />
        </header>
        <I18nProvider locale="en" messages={MESSAGES.en} fallback={FALLBACK}>
          <main className="flex-1">{children}</main>
        </I18nProvider>
      </div>
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside className="kun-pop absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-line bg-canvas shadow-2xl">
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ink/5">
              <X size={15} weight="bold" aria-hidden />
            </button>
            <SideNav email={email} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
