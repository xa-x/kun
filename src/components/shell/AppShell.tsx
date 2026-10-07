"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CaretUpDown,
  CreditCard,
  GearSix,
  Lightning,
  List,
  Plus,
  ShieldCheck,
  SignOut,
  SquaresFour,
  Stack,
  X,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Wordmark } from "../Wordmark";
import { SettingsModal } from "../SettingsModal";
import { useSettings } from "@/lib/use-settings";
import { useSignOut } from "@/lib/use-sign-out";
import { useCreateWorkbook } from "@/lib/use-create-workbook";
import { APP_HOME } from "@/lib/routes";

export interface ShellUser {
  name: string;
  email: string;
  plan: string;
  isAdmin: boolean;
}

const ShellContext = createContext<{ openSettings: () => void }>({
  openSettings: () => {},
});

/** Lets pages inside the shell open the settings dialog. */
export const useShell = () => useContext(ShellContext);

const NAV: {
  href: string;
  label: string;
  icon: Icon;
  active: (path: string) => boolean;
}[] = [
  {
    href: APP_HOME,
    label: "Workbooks",
    icon: SquaresFour,
    active: (p) => p.startsWith(APP_HOME),
  },
  {
    href: "/runs",
    label: "Runs",
    icon: Lightning,
    active: (p) => p.startsWith("/runs"),
  },
  {
    href: "/templates",
    label: "Templates",
    icon: Stack,
    active: (p) => p.startsWith("/templates"),
  },
  {
    href: "/billing",
    label: "Plan and usage",
    icon: CreditCard,
    active: (p) => p.startsWith("/billing"),
  },
];

/**
 * The signed-in frame: persistent sidebar on desktop, a drawer on mobile.
 * The canvas editor deliberately lives outside this shell (see the (editor)
 * route group) because it needs the full viewport.
 */
export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const settings = useSettings();
  // The drawer is open only for the page it was opened on, so navigating
  // closes it without an effect.
  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  const drawer = drawerFor === pathname;
  const setDrawer = useCallback(
    (open: boolean) => setDrawerFor(open ? pathname : null),
    [pathname],
  );

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, setDrawer]);

  const ctx = useMemo(
    () => ({ openSettings: () => settings.setShowSettings(true) }),
    [settings],
  );

  return (
    <ShellContext.Provider value={ctx}>
      <div className="kun-atmosphere relative flex min-h-dvh">
        <div className="kun-grain" aria-hidden />

        <aside className="sticky top-0 z-20 hidden h-dvh w-[248px] shrink-0 border-r border-line/80 bg-canvas/60 backdrop-blur-xl md:flex">
          <SidebarBody user={user} pathname={pathname} />
        </aside>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line/80 bg-canvas/80 px-4 backdrop-blur-xl md:hidden">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open navigation"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <List size={18} weight="bold" aria-hidden />
            </button>
            <Link href={APP_HOME} className="ml-1">
              <Wordmark />
            </Link>
          </header>
          <main className="flex-1">{children}</main>
        </div>

        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawer(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <aside className="kun-pop absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] border-r border-line bg-canvas shadow-2xl">
              <SidebarBody
                user={user}
                pathname={pathname}
                onClose={() => setDrawer(false)}
              />
            </aside>
          </div>
        )}

        {(settings.showSettings || settings.needsOnboard) && (
          <SettingsModal
            env={settings.env}
            onboarding={settings.needsOnboard && !settings.showSettings}
            onClose={settings.dismissOnboard}
          />
        )}
      </div>
    </ShellContext.Provider>
  );
}

function SidebarBody({
  user,
  pathname,
  onClose,
}: {
  user: ShellUser;
  pathname: string;
  onClose?: () => void;
}) {
  const { create, creating } = useCreateWorkbook();
  const { openSettings } = useShell();

  return (
    <div className="flex h-full w-full flex-col px-3 py-4">
      <div className="mb-5 flex items-center justify-between px-2">
        <Link href={APP_HOME} aria-label="Kun home">
          <Wordmark />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => void create("blank")}
        disabled={!!creating}
        className="kun-btn-secondary mb-5 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] font-medium disabled:opacity-60"
      >
        <Plus size={14} weight="bold" aria-hidden />
        {creating === "blank" ? "Creating…" : "New workbook"}
      </button>

      <nav aria-label="Workspace" className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = item.active(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] transition-colors ${
                active
                  ? "bg-ink/[0.08] font-medium text-ink"
                  : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <item.icon
                size={17}
                weight={active ? "fill" : "regular"}
                aria-hidden
              />
              {item.label}
            </Link>
          );
        })}
        {user.isAdmin && (
          <Link
            href="/admin"
            className="flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ShieldCheck size={17} aria-hidden />
            Admin
          </Link>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-6">
        <button
          type="button"
          onClick={openSettings}
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] text-muted transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <GearSix size={17} aria-hidden />
          Settings
        </button>
        <AccountMenu user={user} />
      </div>
    </div>
  );
}

function initials(name: string, email: string) {
  const src = (name || email).trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function AccountMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { signOut, busy } = useSignOut();

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div ref={ref} className="relative">
      {open && (
        <div
          role="menu"
          className="kun-pop absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-2xl border border-line2 bg-raised p-1.5 shadow-2xl shadow-black/40"
        >
          <div className="px-3 pb-2 pt-1.5">
            <p className="truncate text-[13px] font-medium text-ink">
              {user.name || user.email}
            </p>
            <p className="truncate text-[12px] text-muted">{user.email}</p>
          </div>
          <Link
            href="/billing"
            role="menuitem"
            onClick={close}
            className="flex h-9 items-center justify-between rounded-xl px-3 text-[13px] text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            Plan
            <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-medium capitalize text-ink">
              {user.plan}
            </span>
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            disabled={busy}
            className="flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[13px] text-muted transition-colors hover:bg-err/10 hover:text-err disabled:opacity-60"
          >
            <SignOut size={15} aria-hidden />
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card/60 p-2 text-left transition-colors hover:border-line2"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[12px] font-semibold text-ink">
          {initials(user.name, user.email)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">
            {user.name || user.email}
          </span>
          <span className="block truncate text-[11.5px] capitalize text-faint">
            {user.plan} plan
          </span>
        </span>
        <CaretUpDown size={14} className="shrink-0 text-faint" aria-hidden />
      </button>
    </div>
  );
}
