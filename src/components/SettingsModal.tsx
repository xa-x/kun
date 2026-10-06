"use client";

import { useTheme } from "./ThemeProvider";

/**
 * System status dialog — there are no user-facing keys anymore. The
 * platform's OpenRouter key lives in the server's .env, so this only
 * reports whether runs are possible (used by onboarding when .env is
 * missing) and hosts the appearance preference.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-sm">
      <div className="kun-pop w-full max-w-md overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-black/50">
        {/* header */}
        <div className="flex items-start justify-between px-5 pb-3 pt-4">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">
              {onboarding ? "Welcome to كُن" : "Settings"}
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-muted">
              {onboarding
                ? "One thing to check before you start."
                : "Platform status and appearance."}
            </p>
          </div>
          {!onboarding && (
            <button
              onClick={onClose}
              title="Close"
              className="flex h-6 w-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-white/5 hover:text-ink"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-auto px-5 pb-1">
          <div
            className={`rounded-lg border p-3 ${
              configured ? "border-ok/40" : "border-warn/50"
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">
                OpenRouter
              </span>
              <span
                className={`rounded-full border px-1.5 py-px font-mono text-[8.5px] uppercase tracking-wider ${
                  configured
                    ? "border-ok/40 text-ok"
                    : "border-warn/50 text-warn"
                }`}
              >
                {configured ? "configured" : "not configured"}
              </span>
            </div>
            <p className="text-[11.5px] leading-snug text-muted">
              {configured
                ? "All models run through the platform's OpenRouter key — nothing to set up."
                : "Runs are disabled until the operator sets OPENROUTER_API_KEY in the server .env."}
            </p>
          </div>

          <div>
            <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">
              Appearance
            </p>
            <div className="flex gap-1">
              {(["system", "light", "dark"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => theme.setPref(opt)}
                  className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${
                    theme.pref === opt
                      ? "bg-ink text-canvas"
                      : "border border-line text-muted"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* actions */}
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-line bg-sunken/50 px-5 py-3">
          <button
            onClick={onClose}
            className="kun-btn-primary rounded-full px-4 py-1.5 text-[12px] font-medium transition-all hover:brightness-110 active:scale-[0.98]"
          >
            {onboarding ? "Got it" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
