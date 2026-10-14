"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTheme } from "./ThemeProvider";
import { Modal } from "./ui/Modal";
import { readJson } from "@/lib/http";
import { useSignOut } from "@/lib/use-sign-out";
import type { ThemePref } from "@/lib/theme";

const THEMES: { value: ThemePref; label: MessageKey }[] = [
  { value: "system", label: "settings.appearance.system" },
  { value: "light", label: "settings.appearance.light" },
  { value: "dark", label: "settings.appearance.dark" },
];

interface Account {
  user: { email: string; name?: string | null } | null;
  org?: { name: string };
  plan?: { label: string };
  platformAdmin?: boolean;
}

interface Usage {
  usage: {
    runs: number;
    runLimit: number;
    includedUsd: number;
    creditAllowanceUsd: number;
    balanceUsd: number;
  };
}

const usd = (micro: number) => `$${(micro / 1e6).toFixed(2)}`;

/**
 * Account and preferences: who is signed in, the plan and this month's usage
 * with a way to billing, the theme, and sign out. Platform status (is the
 * OpenRouter key set) is operator information, so only platform admins see it
 * here; first-run onboarding still shows it to whoever hits an unconfigured
 * instance, since runs cannot work for anyone.
 */
export function SettingsModal({
  env,
  onboarding = false,
  onClose,
}: {
  env: Record<string, boolean>;
  onboarding?: boolean;
  onClose: () => void;
}) {
  const { t, num } = useI18n();
  const theme = useTheme();
  const { signOut, busy } = useSignOut();
  const configured = !!env.openrouter;
  const [account, setAccount] = useState<Account | null>(null);
  const [usage, setUsage] = useState<Usage["usage"] | null>(null);

  useEffect(() => {
    if (onboarding) return;
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => readJson<Account>(r))
      .then((a) => alive && setAccount(a))
      .catch(() => {});
    fetch("/api/billing")
      .then((r) => readJson<Usage>(r))
      .then((b) => alive && b.usage && setUsage(b.usage))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [onboarding]);

  const showStatus = onboarding || !!account?.platformAdmin;
  const status = (
    <div
      className={`flex gap-3 rounded-xl border p-4 ${
        configured ? "border-ok/40 bg-ok/5" : "border-warn/50 bg-warn/5"
      }`}
    >
      {configured ? (
        <CheckCircle size={20} weight="fill" className="mt-px shrink-0 text-ok" aria-hidden />
      ) : (
        <WarningCircle size={20} weight="fill" className="mt-px shrink-0 text-warn" aria-hidden />
      )}
      <div>
        <p className="text-[14px] font-medium text-ink">
          {configured ? t("settings.modal.keySet") : t("settings.modal.runsUnavailable")}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {configured
            ? t("settings.modal.keySetBody")
            : onboarding
              ? t("settings.modal.onboardingBody")
              : t("settings.modal.adminBody")}
        </p>
      </div>
    </div>
  );

  if (onboarding) {
    return (
      <Modal
        title={t("settings.modal.welcome")}
        description={t("settings.modal.welcomeDesc")}
        onClose={onClose}
        dismissible={false}
        footer={
          <button
            type="button"
            onClick={onClose}
            className="kun-btn-primary h-10 rounded-full px-6 text-[13.5px] font-medium"
          >
            {t("settings.modal.gotIt")}
          </button>
        }
      >
        {status}
      </Modal>
    );
  }

  const email = account?.user?.email;
  return (
    <Modal
      title={t("common.settings")}
      description={t("settings.modal.desc")}
      onClose={onClose}
      footer={
        <>
          <Link
            href="/settings"
            className="me-auto text-[13px] text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
          >
            {t("settings.modal.allSettings")}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="kun-btn-primary h-10 rounded-full px-6 text-[13.5px] font-medium"
          >
            {t("common.done")}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <section aria-label={t("settings.modal.account")} className="rounded-xl border border-line p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-ink" dir="ltr">
                {email ?? t("common.loading")}
              </p>
              {account?.org && (
                <p className="mt-0.5 truncate text-[12.5px] text-muted" dir="auto">
                  {account.org.name}
                </p>
              )}
            </div>
            {account?.plan && (
              <span className="shrink-0 rounded-full bg-ink/[0.08] px-2.5 py-1 text-[11.5px] font-medium text-ink">
                {account.plan.label}
              </span>
            )}
          </div>

          {usage && (
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[12.5px]">
              <div>
                <dt className="text-muted">{t("settings.modal.runs")}</dt>
                <dd className="mt-0.5 font-mono text-ink">
                  {num(usage.runs)} / {num(usage.runLimit)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t("settings.modal.credits")}</dt>
                <dd className="mt-0.5 font-mono text-ink" dir="ltr">
                  {usd(usage.includedUsd)} / ${usage.creditAllowanceUsd}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t("settings.modal.balance")}</dt>
                <dd className="mt-0.5 font-mono text-ink">{usd(usage.balanceUsd)}</dd>
              </div>
            </dl>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/billing"
              className="inline-flex h-9 items-center rounded-full border border-line px-4 text-[13px] text-ink transition-colors hover:bg-ink/5"
            >
              {t("settings.modal.planBilling")}
            </Link>
            {account?.platformAdmin && (
              <Link
                href="/admin"
                className="inline-flex h-9 items-center rounded-full border border-line px-4 text-[13px] text-ink transition-colors hover:bg-ink/5"
              >
                {t("settings.modal.adminConsole")}
              </Link>
            )}
            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="ms-auto inline-flex h-9 items-center rounded-full px-4 text-[13px] text-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              {busy ? t("settings.session.signingOut") : t("common.signOut")}
            </button>
          </div>
        </section>

        <div>
          <p className="mb-2.5 text-[13px] font-medium text-ink">{t("settings.appearance.title")}</p>
          <div
            role="radiogroup"
            aria-label={t("settings.appearance.theme")}
            className="inline-flex gap-1 rounded-full border border-line p-1"
          >
            {THEMES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme.pref === value}
                onClick={() => theme.setPref(value)}
                className={`h-8 rounded-full px-4 text-[13px] transition-colors ${
                  theme.pref === value
                    ? "bg-ink font-medium text-canvas"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-[13px] font-medium text-ink">{t("settings.language.title")}</p>
          <LanguageSwitcher />
        </div>

        {showStatus && status}
      </div>
    </Modal>
  );
}
