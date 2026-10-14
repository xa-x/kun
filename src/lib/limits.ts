import { and, count, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  apiKeys,
  artifacts,
  graphs,
  memberships,
  organizations,
  schedules,
  webhookEndpoints,
  workspaceInvites,
} from "@/db/schema";
import { fits, fmtMb, PlanLimitError, planOf, storageLimitBytes, type Plan } from "./billing";

export interface WorkspaceUsage {
  projects: number;
  storageBytes: number;
  members: number;
  invites: number;
  schedules: number;
  webhooks: number;
  keys: number;
}

const n = (v: unknown) => Number(v ?? 0);

/** What a workspace is using right now, measured against its plan's limits. */
export async function workspaceUsage(orgId: string): Promise<WorkspaceUsage> {
  const [[p], [s], [m], [i], [sc], [w], [k]] = await Promise.all([
    db.select({ v: count() }).from(graphs).where(eq(graphs.orgId, orgId)),
    db
      .select({ v: sql<number>`coalesce(sum(${artifacts.bytes}), 0)` })
      .from(artifacts)
      .where(eq(artifacts.orgId, orgId)),
    db.select({ v: count() }).from(memberships).where(eq(memberships.orgId, orgId)),
    db
      .select({ v: count() })
      .from(workspaceInvites)
      .where(and(eq(workspaceInvites.orgId, orgId), gt(workspaceInvites.expiresAt, new Date()))),
    db.select({ v: count() }).from(schedules).where(eq(schedules.orgId, orgId)),
    db.select({ v: count() }).from(webhookEndpoints).where(eq(webhookEndpoints.orgId, orgId)),
    db.select({ v: count() }).from(apiKeys).where(eq(apiKeys.orgId, orgId)),
  ]);
  return {
    projects: n(p?.v),
    storageBytes: n(s?.v),
    members: n(m?.v),
    invites: n(i?.v),
    schedules: n(sc?.v),
    webhooks: n(w?.v),
    keys: n(k?.v),
  };
}

const upgrade = (plan: Plan) => (plan.id === "free" ? " Upgrade to Pro for more." : plan.id === "pro" ? " Team has more." : "");

/** Refuse to create another project once the plan's project limit is reached. */
export async function assertCanCreateProject(orgId: string, planId: string | null | undefined, adding = 1) {
  const plan = planOf(planId);
  if (plan.projects === null) return;
  const [row] = await db.select({ v: count() }).from(graphs).where(eq(graphs.orgId, orgId));
  if (!fits(n(row?.v), adding, plan.projects)) {
    throw new PlanLimitError(
      `The ${plan.label} plan holds ${plan.projects} projects per workspace.${upgrade(plan)}`,
    );
  }
}

/** Refuse a file that would push the workspace over its storage allowance. */
export async function assertStorageFits(orgId: string, adding: number) {
  const [org] = await db
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const plan = planOf(org?.plan);
  const [row] = await db
    .select({ v: sql<number>`coalesce(sum(${artifacts.bytes}), 0)` })
    .from(artifacts)
    .where(eq(artifacts.orgId, orgId));
  if (!fits(n(row?.v), adding, storageLimitBytes(plan))) {
    throw new PlanLimitError(
      `This workspace is out of file storage (${fmtMb(plan.storageMb)} on ${plan.label}). Delete files in Assets to free space.${upgrade(plan)}`,
    );
  }
}

/** People in a workspace; the seat count that sets a Team plan's allowance. */
export async function memberCount(orgId: string): Promise<number> {
  const [row] = await db.select({ v: count() }).from(memberships).where(eq(memberships.orgId, orgId));
  return n(row?.v);
}
