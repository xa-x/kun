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
  GearSix,
  Images,
  Lightning,
  List,
  Plus,
  ShieldCheck,
  SignOut,
  SquaresFour,
  UsersThree,
  Globe,
  X,
} from "@phosphor-icons/react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import type { Icon } from "@phosphor-icons/react";
import { Wordmark } from "../Wordmark";
import { SettingsModal } from "../SettingsModal";
import { useSettings } from "@/lib/use-settings";
import { useSignOut } from "@/lib/use-sign-out";
import { useCreateWorkbook } from "@/lib/use-create-workbook";
import { APP_HOME } from "@/lib/routes";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { planName } from "./plan";

export interface ShellUser {
  name: string;
  email: string;
  plan: string;
  isAdmin: boolean;
  workspace: { id: string; name: string; plan: string };
}

const ShellContext = createContext<{ openSettings: () => void }>({
  openSettings: () => {},
});

/** Lets pages inside the shell open the settings dialog. */
export const useShell = () => useContext(ShellContext);

const NAV: {
  href: string;
  label: MessageKey;
  icon: Icon;
  active: (path: string) => boolean;
}[] = [
  {
    href: APP_HOME,
    label: "shell.nav.workspace",
    icon: SquaresFour,
    active: (p) => p.startsWith(APP_HOME),
  },
  {
    href: "/assets",
    label: "shell.nav.assets",
    icon: Images,
    active: (p) => p.startsWith("/assets"),
  },
  {
    href: "/shared",
    label: "shell.nav.shared",
    icon: UsersThree,
    active: (p) => p.startsWith("/shared"),
  },
  {
    href: "/community",
    label: "shell.nav.community",
    icon: Globe,
    active: (p) => p.startsWith("/community") || p.startsWith("/templates"),
  },
  {
    href: "/runs",
    label: "shell.nav.runs",
    icon: Lightning,
    active: (p) => p.startsWith("/runs"),
  },
];

/**
 * The signed-in frame: persistent sidebar on desktop, a drawer on mobile.
 * The canvas editor deliberately lives outside this shell (see the (editor)
 * route group) because it needs the full viewport.
 */
export function AppShell({
  user,
  banner,
  children,
}: {
  user: ShellUser;
  /** A platform announcement, shown above the page. */
  banner?: { text: string; level: "info" | "warn" } | null;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
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

        <aside className="sticky top-0 z-20 hidden h-dvh w-[248px] shrink-0 border-e border-line/80 bg-canvas/60 backdrop-blur-xl md:flex">
          <SidebarBody user={user} pathname={pathname} />
        </aside>

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line/80 bg-canvas/80 px-4 backdrop-blur-xl md:hidden">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label={t("shell.nav.open")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <List size={18} weight="bold" aria-hidden />
            </button>
            <Link href={APP_HOME} className="ms-1">
              <Wordmark />
            </Link>
          </header>
          {banner && (
            <div
              role="status"
              dir="auto"
              className={`border-b px-5 py-2.5 text-center text-[13px] ${
                banner.level === "warn" ? "border-warn/40 bg-warn/10 text-warn" : "border-line bg-ink/[0.05] text-ink"
              }`}
            >
              {banner.text}
            </div>
          )}
          <main className="flex-1">{children}</main>
        </div>

        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label={t("shell.nav.close")}
              onClick={() => setDrawer(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <aside className="kun-pop absolute inset-y-0 start-0 flex w-[280px] max-w-[85vw] border-e border-line bg-canvas shadow-2xl">
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
  const { t } = useI18n();
  const { create, creating } = useCreateWorkbook();

  return (
    <div className="flex h-full w-full flex-col px-3 py-4">
      <div className="mb-5 flex items-center justify-between px-2">
        <Link href={APP_HOME} aria-label={t("shell.nav.home")}>
          <Wordmark />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("shell.nav.close")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        )}
      </div>

      <WorkspaceSwitcher current={user.workspace} />

      <button
        type="button"
        onClick={() => void create("blank")}
        disabled={!!creating}
        className="kun-btn-secondary mb-5 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] font-medium disabled:opacity-60"
      >
        <Plus size={14} weight="bold" aria-hidden />
        {creating === "blank" ? t("common.creating") : t("shell.nav.newProject")}
      </button>

      <nav aria-label={t("common.workspace")} className="flex flex-col gap-0.5">
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
              {t(item.label)}
            </Link>
          );
        })}
        {user.isAdmin && (
          <Link
            href="/admin"
            className="flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ShieldCheck size={17} aria-hidden />
            {t("shell.nav.admin")}
          </Link>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-6">
        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") || pathname.startsWith("/billing") ? "page" : undefined}
          className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] transition-colors ${
            pathname.startsWith("/settings") || pathname.startsWith("/billing")
              ? "bg-ink/[0.08] font-medium text-ink"
              : "text-muted hover:bg-ink/5 hover:text-ink"
          }`}
        >
          <GearSix size={17} weight={pathname.startsWith("/settings") ? "fill" : "regular"} aria-hidden />
          {t("common.settings")}
        </Link>
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
  const { t } = useI18n();
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
            <p dir="auto" className="truncate text-[13px] font-medium text-ink">
              {user.name || user.email}
            </p>
            <p dir="ltr" className="truncate text-start text-[12px] text-muted">{user.email}</p>
          </div>
          <Link
            href="/settings/usage"
            role="menuitem"
            onClick={close}
            className="flex h-9 items-center justify-between rounded-xl px-3 text-[13px] text-muted transition-colors hover:bg-ink/5 hover:text-ink"
          >
            {t("shell.account.plan")}
            <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-medium capitalize text-ink">
              {planName(t, user.plan)}
            </span>
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            disabled={busy}
            className="flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-start text-[13px] text-muted transition-colors hover:bg-err/10 hover:text-err disabled:opacity-60"
          >
            <SignOut size={15} aria-hidden />
            {busy ? t("shell.account.signingOut") : t("common.signOut")}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card/60 p-2 text-start transition-colors hover:border-line2"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[12px] font-semibold text-ink">
          {initials(user.name, user.email)}
        </span>
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block truncate text-[13px] font-medium text-ink">
            {user.name || user.email}
          </span>
          <span className="block truncate text-[11.5px] capitalize text-faint">
            {t("shell.account.planName", { plan: planName(t, user.plan) })}
          </span>
        </span>
        <CaretUpDown size={14} className="shrink-0 text-faint" aria-hidden />
      </button>
    </div>
  );
}
