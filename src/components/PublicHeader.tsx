"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";
import { GearIcon } from "./AppHeader";
import { SettingsModal } from "./SettingsModal";
import { useSettings } from "@/lib/use-settings";
import { fetchSessionInfo, type SessionInfo } from "@/lib/session-info";
import { SIGNUP_OPEN } from "@/lib/signup-mode";

/** Chrome for public pages: marketing nav plus auth-aware actions. */
export function PublicHeader() {
  const pathname = usePathname();
  const settings = useSettings();
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    void fetchSessionInfo().then(setSession);
  }, []);

  return (
    <>
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-6 border-b border-line/80 px-5">
        <Link href={session?.user ? "/" : "/sign-in"} className="shrink-0">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink href="/templates" current={pathname.startsWith("/templates")}>
            Templates
          </NavLink>
          <NavLink href="/pricing" current={pathname.startsWith("/pricing")}>
            Pricing
          </NavLink>
          {session?.platformAdmin && (
            <NavLink href="/admin" current={false}>
              Admin
            </NavLink>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {session === null ? null : session.user ? (
            <>
              <Link
                href="/"
                className="kun-btn-primary rounded-full px-4 py-1.5 text-[12.5px] font-medium"
              >
                Open app
              </Link>
              <button
                onClick={() => settings.setShowSettings(true)}
                title="Settings — provider keys"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-white/5 hover:text-ink"
              >
                <GearIcon />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-full px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:text-ink"
              >
                Sign in
              </Link>
              {SIGNUP_OPEN ? (
                <Link
                  href="/sign-up"
                  className="kun-btn-primary rounded-full px-4 py-1.5 text-[12.5px] font-medium"
                >
                  Create account
                </Link>
              ) : (
                <Link
                  href="/sign-up"
                  title="Account creation is invite-only during development"
                  className="rounded-full border border-line px-4 py-1.5 text-[12.5px] text-muted"
                >
                  Sign up · invite only
                </Link>
              )}
            </>
          )}
        </div>
      </header>
      {(settings.showSettings || settings.needsOnboard) && (
        <SettingsModal
          env={settings.env}
          onboarding={settings.needsOnboard && !settings.showSettings}
          onClose={settings.dismissOnboard}
        />
      )}
    </>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${
        current
          ? "bg-white/[0.06] text-ink"
          : "text-muted hover:bg-white/[0.04] hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
