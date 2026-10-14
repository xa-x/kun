"use client";

import { Check, Minus } from "@phosphor-icons/react";
import { fmtMb, PLANS, type Plan, type PlanId } from "@/lib/billing";
import { useI18n } from "@/lib/i18n";
import { planLabel } from "../settings/ui";

type T = ReturnType<typeof useI18n>;

function features(p: Plan, { t, tn }: T): { label: string; on: boolean }[] {
  return [
    p.seatUsd
      ? { label: t("settings.plan.runsSeat", { n: p.monthlyRuns.toLocaleString() }), on: true }
      : { label: tn("settings.plan.runs", p.monthlyRuns), on: true },
    p.seatUsd
      ? { label: t("settings.plan.creditsSeat", { amount: `$${p.monthlyCreditsUsd}` }), on: true }
      : { label: t("settings.plan.credits", { amount: `$${p.monthlyCreditsUsd}` }), on: true },
    {
      label: p.projects === null ? t("settings.plan.projectsUnlimited") : tn("settings.plan.projects", p.projects),
      on: true,
    },
    { label: t("settings.plan.storage", { size: fmtMb(p.storageMb) }), on: true },
    { label: tn("settings.plan.workspaces", p.workspaces), on: true },
    { label: p.members > 1 ? tn("settings.plan.members", p.members) : t("settings.plan.onePerson"), on: p.members > 1 },
    { label: t("settings.plan.topups"), on: p.topups },
    { label: t("settings.plan.schedules"), on: p.schedules },
    { label: t("settings.plan.mcp"), on: p.mcp },
    { label: t("settings.plan.versions"), on: p.versions },
    { label: t("settings.plan.team"), on: p.team },
    ...(p.minSeats ? [{ label: t("settings.plan.minSeats", { n: p.minSeats }), on: true }] : []),
  ];
}

function price(p: Plan, t: T["t"]) {
  if (p.seatUsd) return { amount: `$${p.seatUsd}`, unit: t("settings.plan.perSeat") };
  if (p.monthlyUsd) return { amount: `$${p.monthlyUsd}`, unit: t("settings.plan.perMonth") };
  return { amount: "$0", unit: t("settings.plan.freeForever") };
}

/**
 * The three plans, side by side. Presentational: callers decide what the
 * button does and what it says.
 */
export function PlanGrid({
  current,
  busy,
  label,
  onSelect,
}: {
  current?: PlanId;
  busy?: PlanId | null;
  label: (plan: Plan, isCurrent: boolean) => string;
  onSelect: (plan: PlanId) => void;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {Object.values(PLANS).map((p) => {
        const isCurrent = current === p.id;
        const featured = p.id === "pro";
        const { amount, unit } = price(p, t);
        return (
          <li
            key={p.id}
            className={`flex flex-col rounded-2xl border p-6 ${
              featured
                ? "border-ink/40 bg-card shadow-xl shadow-black/20"
                : "border-line bg-card/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-medium text-ink">{planLabel(t, p.id, p.label)}</h3>
              {featured && (
                <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11.5px] font-medium text-canvas">
                  {t("settings.plan.mostPopular")}
                </span>
              )}
            </div>
            <p className="mt-5 flex items-baseline gap-2">
              <span className="text-[38px] font-semibold leading-none tracking-tight text-ink">
                {amount}
              </span>
              <span className="text-[13px] text-muted">{unit}</span>
            </p>

            <ul className="mt-6 flex-1 space-y-3">
              {features(p, i18n).map((f) => (
                <li
                  key={f.label}
                  className={`flex items-start gap-3 text-[13.5px] leading-snug ${
                    f.on ? "text-ink/90" : "text-faint"
                  }`}
                >
                  {f.on ? (
                    <Check
                      size={15}
                      weight="bold"
                      className="mt-px shrink-0 text-ok"
                      aria-label={t("settings.plan.included")}
                    />
                  ) : (
                    <Minus
                      size={15}
                      weight="bold"
                      className="mt-px shrink-0"
                      aria-label={t("settings.plan.notIncluded")}
                    />
                  )}
                  {f.label}
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={isCurrent || (busy ?? null) !== null}
              onClick={() => onSelect(p.id)}
              className={`mt-7 flex h-11 w-full items-center justify-center rounded-full text-[14px] font-medium transition-opacity disabled:cursor-default ${
                isCurrent
                  ? "border border-line text-faint"
                  : featured
                    ? "kun-btn-primary"
                    : "kun-btn-secondary"
              } ${busy && busy !== p.id ? "opacity-50" : ""}`}
            >
              {label(p, isCurrent)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
