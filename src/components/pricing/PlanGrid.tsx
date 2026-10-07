import { Check, Minus } from "@phosphor-icons/react";
import { PLANS, type Plan, type PlanId } from "@/lib/billing";

function features(p: Plan): { label: string; on: boolean }[] {
  return [
    { label: `${p.monthlyRuns.toLocaleString()} runs a month`, on: true },
    {
      label: p.monthlyCreditsUsd
        ? `$${p.monthlyCreditsUsd} of model credits a month`
        : "Pay for model usage as you go",
      on: true,
    },
    { label: "Cron schedules and webhooks", on: p.schedules },
    { label: "MCP server and API keys", on: p.mcp },
    { label: "Workbook version history", on: p.versions },
    { label: "Team workspaces", on: p.team },
  ];
}

function price(p: Plan) {
  if (p.seatUsd) return { amount: `$${p.seatUsd}`, unit: "per seat, per month" };
  if (p.monthlyUsd) return { amount: `$${p.monthlyUsd}`, unit: "per month" };
  return { amount: "$0", unit: "free forever" };
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
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {Object.values(PLANS).map((p) => {
        const isCurrent = current === p.id;
        const featured = p.id === "pro";
        const { amount, unit } = price(p);
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
              <h3 className="text-[16px] font-medium text-ink">{p.label}</h3>
              {featured && (
                <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11.5px] font-medium text-canvas">
                  Most popular
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
              {features(p).map((f) => (
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
                      aria-label="Included"
                    />
                  ) : (
                    <Minus
                      size={15}
                      weight="bold"
                      className="mt-px shrink-0"
                      aria-label="Not included"
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
