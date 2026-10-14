export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  label: string;
  monthlyUsd: number;
  seatUsd?: number;
  monthlyRuns: number;
  /**
   * Model usage included each month, in USD. It resets monthly and is spent
   * before the org's prepaid balance; with both at zero, new runs are refused.
   */
  monthlyCreditsUsd: number;
  /** Whether the org may buy prepaid credits on top of the included ones. */
  topups: boolean;
  schedules: boolean;
  webhooks: boolean;
  mcp: boolean;
  versions: boolean;
  team: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "Free",
    monthlyUsd: 0,
    monthlyRuns: 50,
    monthlyCreditsUsd: 1,
    topups: false,
    schedules: false,
    webhooks: false,
    mcp: false,
    versions: false,
    team: false,
  },
  pro: {
    id: "pro",
    label: "Pro",
    monthlyUsd: 24,
    monthlyRuns: 2000,
    monthlyCreditsUsd: 15,
    topups: true,
    schedules: true,
    webhooks: true,
    mcp: true,
    versions: true,
    team: false,
  },
  team: {
    id: "team",
    label: "Team",
    monthlyUsd: 0,
    seatUsd: 20,
    monthlyRuns: 10_000,
    monthlyCreditsUsd: 40,
    topups: true,
    schedules: true,
    webhooks: true,
    mcp: true,
    versions: true,
    team: true,
  },
};

export function planOf(id: string | null | undefined): Plan {
  if (id === "pro" || id === "team") return PLANS[id];
  return PLANS.free;
}

/** Prepaid top-up sizes, in USD. */
export const TOPUP_AMOUNTS_USD = [10, 25, 50] as const;

/**
 * Split a charge between the month's included credits and the prepaid
 * balance, included credits first. All amounts are micro-dollars. Whatever
 * neither covers is the overshoot of the run that crossed the line.
 */
export function splitCharge(amount: number, includedLeft: number, balance: number) {
  const fromIncluded = Math.min(amount, Math.max(0, includedLeft));
  const fromBalance = Math.min(amount - fromIncluded, Math.max(0, balance));
  return { fromIncluded, fromBalance };
}

export function monthStart(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export class PlanLimitError extends Error {
  status = 402;
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}
