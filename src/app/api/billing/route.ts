import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizations, runs, usageLedger } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { allowance, monthStart, PLANS, planOf, TOPUP_AMOUNTS_USD } from "@/lib/billing";
import { memberCount } from "@/lib/limits";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const plan = planOf(actor.org.plan);
    const allow = allowance(plan, await memberCount(actor.org.id));
    const since = new Date(monthStart());
    const [runCount] = await db
      .select({ n: sql<number>`count(*)` })
      .from(runs)
      .where(and(eq(runs.orgId, actor.org.id), gte(runs.createdAt, since)));
    const [spend] = await db
      .select({
        usd: sql<number>`coalesce(sum(${usageLedger.amountUsd}), 0)`,
        fromBalance: sql<number>`coalesce(sum(${usageLedger.balanceUsd}), 0)`,
        tokens: sql<number>`coalesce(sum(${usageLedger.tokens}), 0)`,
      })
      .from(usageLedger)
      .where(and(eq(usageLedger.orgId, actor.org.id), gte(usageLedger.createdAt, since)));
    // Read fresh: the actor's org row may predate a top-up or a charge.
    const [org] = await db
      .select({ balance: organizations.creditBalance })
      .from(organizations)
      .where(eq(organizations.id, actor.org.id))
      .limit(1);
    return NextResponse.json({
      plan,
      plans: Object.values(PLANS),
      topupAmountsUsd: TOPUP_AMOUNTS_USD,
      usage: {
        runs: Number(runCount?.n ?? 0),
        runLimit: allow.runs,
        amountUsd: Number(spend?.usd ?? 0),
        tokens: Number(spend?.tokens ?? 0),
        includedUsd: Number(spend?.usd ?? 0) - Number(spend?.fromBalance ?? 0),
        creditAllowanceUsd: allow.creditsUsd,
        balanceUsd: org?.balance ?? 0,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
