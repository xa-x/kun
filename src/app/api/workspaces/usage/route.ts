import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizations, runs, usageLedger } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { allowance, monthStart, planOf, storageLimitBytes, uploadLimitBytes } from "@/lib/billing";
import { memberCount, workspaceUsage } from "@/lib/limits";

export const runtime = "nodejs";

/** One call for the Plan & usage screen: the plan's limits beside what is used. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const plan = planOf(actor.org.plan);
    const allow = allowance(plan, await memberCount(actor.org.id));
    const since = new Date(monthStart());
    const [use, [runCount], [spend], [org]] = await Promise.all([
      workspaceUsage(actor.org.id),
      db
        .select({ n: sql<number>`count(*)` })
        .from(runs)
        .where(and(eq(runs.orgId, actor.org.id), gte(runs.createdAt, since))),
      db
        .select({
          usd: sql<number>`coalesce(sum(${usageLedger.amountUsd}), 0)`,
          fromBalance: sql<number>`coalesce(sum(${usageLedger.balanceUsd}), 0)`,
        })
        .from(usageLedger)
        .where(and(eq(usageLedger.orgId, actor.org.id), gte(usageLedger.createdAt, since))),
      db
        .select({ balance: organizations.creditBalance })
        .from(organizations)
        .where(eq(organizations.id, actor.org.id))
        .limit(1),
    ]);
    const spent = Number(spend?.usd ?? 0);
    return NextResponse.json({
      plan: { id: plan.id, label: plan.label },
      resetsAt: new Date(Date.UTC(new Date(since).getUTCFullYear(), new Date(since).getUTCMonth() + 1, 1)).toISOString(),
      meters: {
        runs: { used: Number(runCount?.n ?? 0), limit: allow.runs },
        credits: {
          usedMicro: spent - Number(spend?.fromBalance ?? 0),
          limitMicro: allow.creditsUsd * 1e6,
          balanceMicro: org?.balance ?? 0,
        },
        projects: { used: use.projects, limit: plan.projects },
        storage: { used: use.storageBytes, limit: storageLimitBytes(plan) },
        members: { used: use.members, limit: plan.members },
        upload: { limit: uploadLimitBytes(plan) },
      },
      features: {
        schedules: { on: plan.schedules, used: use.schedules },
        webhooks: { on: plan.webhooks, used: use.webhooks },
        mcp: { on: plan.mcp, used: use.keys },
        versions: { on: plan.versions },
        team: { on: plan.team },
        topups: { on: plan.topups },
      },
    });
  } catch (e) {
    return fail(e);
  }
}
