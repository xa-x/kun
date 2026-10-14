import { NextRequest, NextResponse } from "next/server";
import { desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { creditTopups, organizations, runNodes, usageLedger } from "@/db/schema";
import { fail } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

/** Money in and out: credits sold, what users were charged, and what models cost us. */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [sold, charged, byModel, topups, plans] = await Promise.all([
      db
        .select({ source: creditTopups.source, v: sql<number>`coalesce(sum(${creditTopups.amountUsd}), 0)::float`, n: sql<number>`count(*)::int` })
        .from(creditTopups)
        .where(gte(creditTopups.createdAt, since))
        .groupBy(creditTopups.source),
      db
        .select({ v: sql<number>`coalesce(sum(${usageLedger.amountUsd}), 0)::float`, bal: sql<number>`coalesce(sum(${usageLedger.balanceUsd}), 0)::float` })
        .from(usageLedger)
        .where(gte(usageLedger.createdAt, since)),
      db
        .select({
          model: runNodes.model,
          calls: sql<number>`count(*)::int`,
          cost: sql<number>`coalesce(sum(${runNodes.costUsd}), 0)::float`,
        })
        .from(runNodes)
        .where(gte(runNodes.createdAt, since))
        .groupBy(runNodes.model)
        .orderBy(desc(sql`sum(${runNodes.costUsd})`))
        .limit(25),
      db
        .select({ t: creditTopups, org: organizations.name })
        .from(creditTopups)
        .leftJoin(organizations, eq(organizations.id, creditTopups.orgId))
        .orderBy(desc(creditTopups.createdAt))
        .limit(25),
      db.select({ plan: organizations.plan, v: sql<number>`count(*)::int` }).from(organizations).groupBy(organizations.plan),
    ]);
    const m = (n: number) => n / 1e6;
    const real = sold.filter((s) => s.source !== "admin" && s.source !== "instant");
    return NextResponse.json({
      window: "last 30 days",
      creditsSoldUsd: m(real.reduce((a, b) => a + b.v, 0)),
      creditsGrantedUsd: m(sold.filter((s) => s.source === "admin" || s.source === "instant").reduce((a, b) => a + b.v, 0)),
      chargedUsd: m(charged[0]?.v ?? 0),
      chargedFromBalanceUsd: m(charged[0]?.bal ?? 0),
      providerCostUsd: m(byModel.reduce((a, b) => a + b.cost, 0)),
      plans: Object.fromEntries(plans.map((p) => [p.plan, p.v])),
      byModel: byModel.map((r) => ({ model: r.model ?? "—", calls: r.calls, costUsd: m(r.cost) })),
      recentTopups: topups.map(({ t, org }) => ({ id: t.id, workspace: org ?? "—", usd: m(t.amountUsd), source: t.source, createdAt: t.createdAt })),
    });
  } catch (e) {
    return fail(e);
  }
}
