export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  label: string;
  monthlyUsd: number;
  /** Per-seat price. A seat-priced plan bills at least `minSeats`. */
  seatUsd?: number;
  minSeats?: number;
  /** On a seat-priced plan, `monthlyRuns` and `monthlyCreditsUsd` are per seat. */
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
  /** Projects per workspace; null is unlimited. */
  projects: number | null;
  /** Files (uploads, generated media, saved photos) per workspace, in MB. */
  storageMb: number;
  /** Largest single upload, in MB. */
  uploadMb: number;
  /** Workspaces one person may own, judged by the best plan they hold. */
  workspaces: number;
  /** People in a workspace, owner included. */
  members: number;
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
    projects: 10,
    storageMb: 500,
    uploadMb: 25,
    workspaces: 2,
    members: 1,
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
    projects: 200,
    storageMb: 20 * 1024,
    uploadMb: 100,
    workspaces: 5,
    members: 1,
  },
  team: {
    id: "team",
    label: "Team",
    monthlyUsd: 0,
    seatUsd: 39,
    minSeats: 3,
    monthlyRuns: 5_000,
    monthlyCreditsUsd: 20,
    topups: true,
    schedules: true,
    webhooks: true,
    mcp: true,
    versions: true,
    team: true,
    projects: null,
    storageMb: 200 * 1024,
    uploadMb: 250,
    workspaces: 10,
    members: 25,
  },
};

const MB = 1024 * 1024;
export const storageLimitBytes = (p: Plan) => p.storageMb * MB;
export const uploadLimitBytes = (p: Plan) => p.uploadMb * MB;

/** Whether `used` plus `adding` still fits under a limit (null = no limit). */
export function fits(used: number, adding: number, limit: number | null): boolean {
  return limit === null || used + adding <= limit;
}

/** How many workspaces someone may own: the most generous plan among the ones they own. */
export function workspaceCap(ownedPlans: (string | null | undefined)[]): number {
  return Math.max(PLANS.free.workspaces, ...ownedPlans.map((id) => planOf(id).workspaces));
}

/** "500 MB", "20 GB" for a size in MB. */
export function fmtMb(mb: number): string {
  return mb >= 1024 ? `${+(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

export function planOf(id: string | null | undefined): Plan {
  if (id === "pro" || id === "team") return PLANS[id];
  return PLANS.free;
}

/** Seats a workspace is billed for: its people, but never fewer than the plan's minimum. */
export function billedSeats(plan: Plan, members: number): number {
  return plan.seatUsd ? Math.max(plan.minSeats ?? 1, members, 1) : 1;
}

/** What a workspace gets each month: per-seat plans scale with the seats billed. */
export function allowance(plan: Plan, members: number) {
  const seats = plan.seatUsd ? billedSeats(plan, members) : 1;
  return { runs: plan.monthlyRuns * seats, creditsUsd: plan.monthlyCreditsUsd * seats };
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
