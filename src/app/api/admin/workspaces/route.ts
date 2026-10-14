import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, graphs, memberships, organizations, usageLedger, users } from "@/db/schema";
import { fail } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-api";
import { monthStart } from "@/lib/billing";
import { isSuspended } from "@/lib/workspace-settings";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80).replace(/[%_\\]/g, "\\$&");
    const orgs = await db
      .select()
      .from(organizations)
      .where(q ? ilike(organizations.name, `%${q}%`) : undefined)
      .orderBy(desc(organizations.createdAt))
      .limit(100);
    if (!orgs.length) return NextResponse.json({ workspaces: [] });
    const ids = orgs.map((o) => o.id);
    const since = new Date(monthStart());
    const [mem, proj, files, spend, owners] = await Promise.all([
      db.select({ orgId: memberships.orgId, v: count() }).from(memberships).where(inArray(memberships.orgId, ids)).groupBy(memberships.orgId),
      db.select({ orgId: graphs.orgId, v: count() }).from(graphs).where(inArray(graphs.orgId, ids)).groupBy(graphs.orgId),
      db
        .select({ orgId: artifacts.orgId, v: sql<number>`coalesce(sum(${artifacts.bytes}), 0)::float` })
        .from(artifacts)
        .where(inArray(artifacts.orgId, ids))
        .groupBy(artifacts.orgId),
      db
        .select({ orgId: usageLedger.orgId, v: sql<number>`coalesce(sum(${usageLedger.amountUsd}), 0)::float` })
        .from(usageLedger)
        .where(and(inArray(usageLedger.orgId, ids), gte(usageLedger.createdAt, since)))
        .groupBy(usageLedger.orgId),
      db
        .select({ orgId: memberships.orgId, email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(inArray(memberships.orgId, ids), eq(memberships.role, "owner"))),
    ]);
    const by = <T extends { orgId: string; v: unknown }>(rows: T[]) => new Map(rows.map((r) => [r.orgId, Number(r.v)]));
    const M = by(mem), P = by(proj), F = by(files), S = by(spend);
    const O = new Map(owners.map((o) => [o.orgId, o.email]));
    return NextResponse.json({
      workspaces: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        plan: o.plan,
        owner: O.get(o.id) ?? null,
        members: M.get(o.id) ?? 0,
        projects: P.get(o.id) ?? 0,
        storageBytes: F.get(o.id) ?? 0,
        spendMonthUsd: (S.get(o.id) ?? 0) / 1e6,
        balanceUsd: o.creditBalance / 1e6,
        billed: Boolean(o.polarSubscriptionId),
        suspended: isSuspended(o.settings),
        createdAt: o.createdAt,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
