"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useTheme } from "./ThemeProvider";
import { Modal } from "./ui/Modal";
import type { ThemePref } from "@/lib/theme";

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * System status dialog. There are no user-facing keys: the platform's
 * OpenRouter key lives in the server's .env, so this only reports whether runs
 * are possible (used by onboarding when .env is missing) and hosts the
 * appearance preference.
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
  const theme = useTheme();
  const configured = !!env.openrouter;

  return (
    <Modal
      title={onboarding ? "Welcome to كُن" : "Settings"}
      description={
        onboarding
          ? "One thing to check before you start."
          : "Platform status and appearance."
      }
      onClose={onClose}
      dismissible={!onboarding}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="kun-btn-primary h-10 rounded-full px-6 text-[13.5px] font-medium"
        >
          {onboarding ? "Got it" : "Done"}
        </button>
      }
    >
      <div className="space-y-6">
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
              OpenRouter {configured ? "is configured" : "is not configured"}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {configured
                ? "Every model runs through the platform's key. There is nothing to set up."
                : "Runs are disabled until the operator sets OPENROUTER_API_KEY in the server environment."}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-[13px] font-medium text-ink">Appearance</p>
          <div
            role="radiogroup"
            aria-label="Theme"
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
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
