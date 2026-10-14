"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readJson } from "@/lib/http";
import { APP_HOME, signInHref } from "@/lib/routes";
import { Wordmark } from "../Wordmark";
import { useI18n } from "@/lib/i18n";
import { btnPrimary } from "./ui";

interface Info {
  workspace: string;
  role: string;
  invitedBy: string;
}

/** The page an invite link opens: who invited you, to what, and one button. */
export function JoinView({ token }: { token: string }) {
  const { t } = useI18n();
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const here = `/join/${token}`;

  useEffect(() => {
    let live = true;
    void fetch(`/api/invites/${token}`)
      .then((r) => (r.ok ? readJson<Info>(r) : null))
      .then((j) => live && setInfo(j))
      .catch(() => live && setInfo(null));
    return () => {
      live = false;
    };
  }, [token]);

  const join = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invites/${token}`, { method: "POST" });
    if (res.status === 401) {
      window.location.assign(signInHref(here));
      return;
    }
    const j = await readJson<{ error?: string }>(res).catch(() => ({} as { error?: string }));
    if (!res.ok) {
      setError(j.error || t("shell.join.failed"));
      setBusy(false);
      return;
    }
    window.location.assign(APP_HOME);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" aria-label={t("shell.nav.home")} className="mb-10 block">
          <Wordmark />
        </Link>
        {info === undefined ? (
          <div className="kun-skeleton h-40" aria-busy />
        ) : info === null ? (
          <>
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">{t("shell.join.invalid")}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">{t("shell.join.invalidBody")}</p>
            <Link href={APP_HOME} className={`${btnPrimary} mt-6`}>
              {t("shell.join.goKun")}
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">{t("shell.join.title", { name: info.workspace })}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              {t(
                info.role === "admin"
                  ? "shell.join.asAdmin"
                  : info.role === "editor"
                    ? "shell.join.asEditor"
                    : "shell.join.asViewer",
                { name: info.invitedBy },
              )}
            </p>
            {error && (
              <p role="alert" className="mt-4 text-[13px] text-err">
                {error}
              </p>
            )}
            <button type="button" onClick={() => void join()} disabled={busy} className={`${btnPrimary} mt-6`}>
              {busy ? t("shell.join.joining") : t("shell.join.join")}
            </button>
            <p className="mt-4 text-[12.5px] text-faint">
              {t("shell.join.signInFirst")}{" "}
              <Link href={`/sign-up?next=${encodeURIComponent(here)}`} className="text-muted underline underline-offset-2 hover:text-ink">
                {t("shell.join.newToKun")}
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
