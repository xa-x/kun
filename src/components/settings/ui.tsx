"use client";

"use client";

import type { ReactNode } from "react";
import { useI18n, type MessageKey } from "@/lib/i18n";

/** A plan's display name in the current language. */
export function planLabel(t: (k: MessageKey) => string, id: string, fallback?: string): string {
  if (id === "free") return t("common.free");
  if (id === "pro") return t("common.pro");
  if (id === "team") return t("common.team");
  return fallback ?? id;
}

/** A titled block of a settings page. */
export function Section({
  title,
  description,
  children,
  danger = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`border-t pt-7 first:border-t-0 first:pt-0 ${danger ? "border-err/30" : "border-line"} [&:not(:first-child)]:mt-9`}
    >
      <h2 className={`text-[15px] font-medium ${danger ? "text-err" : "text-ink"}`}>{title}</h2>
      {description && <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** An on/off switch with a label and what it does. */
export function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5">
      <div className="min-w-0">
        <p className="text-[13.5px] text-ink">{label}</p>
        <p className="mt-0.5 max-w-md text-[12.5px] leading-relaxed text-muted">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-ok/70" : "bg-ink/15"}`}
      >
        <span className={`absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5 rtl:-translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

/** A used-of-limit bar. A null limit means unlimited and shows no bar. */
export function Meter({
  label,
  used,
  limit,
  format,
  hint,
}: {
  label: string;
  used: number;
  limit: number | null;
  format?: (n: number) => string;
  hint?: string;
}) {
  const { t, num } = useI18n();
  const fmt = format ?? ((n: number) => num(n));
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const tone = pct >= 100 ? "bg-err" : pct >= 80 ? "bg-warn" : "bg-ink/70";
  return (
    <div className="py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[13.5px] text-ink">{label}</p>
        <p className="font-mono text-[12.5px] tabular-nums text-muted">
          {fmt(used)} <span className="text-faint">/</span> {limit === null ? t("settings.meter.unlimited") : fmt(limit)}
        </p>
      </div>
      {limit !== null && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10"
        >
          <div className={`h-full rounded-full transition-[width] ${tone}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {hint && <p className="mt-1.5 text-[12px] text-faint">{hint}</p>}
    </div>
  );
}

export const inputCls = "kun-input";
export const btnSecondary =
  "kun-btn-secondary inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-medium transition-transform active:scale-[0.97] disabled:opacity-50";
export const btnPrimary =
  "kun-btn-primary inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-medium transition-transform active:scale-[0.97] disabled:opacity-50";
