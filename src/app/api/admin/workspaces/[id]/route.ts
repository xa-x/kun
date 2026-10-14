import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creditTopups, graphs, memberships, organizations, runs, users } from "@/db/schema";
import { workspaceUsage } from "@/lib/limits";
import { isSuspended } from "@/lib/workspace-settings";
import { fail } from "@/lib/auth";
import { audit, MAX_GRANT_USD, PLAN_IDS, requireAdmin } from "@/lib/admin-api";
import { newId } from "@/lib/ids";

export const runtime = "nodejs";

/**
 * Set a workspace's plan and/or grant it credits. A workspace with a live
 * subscription is managed by Polar, so its plan can't be overridden here.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const { id } = await params;
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const out: Record<string, unknown> = {};

    if (body.plan !== undefined) {
      if (!PLAN_IDS.includes(body.plan)) {
        return NextResponse.json({ error: "Plan must be free, pro or team." }, { status: 400 });
      }
      if (org.polarSubscriptionId && body.plan !== org.plan) {
        return NextResponse.json(
          { error: "This workspace has a live subscription. Change it in Polar so billing stays consistent." },
          { status: 409 },
        );
      }
      if (body.plan !== org.plan) {
        await db.update(organizations).set({ plan: body.plan }).where(eq(organizations.id, id));
        await audit(gate.actor, "workspace.plan", { type: "workspace", id }, { from: org.plan, to: body.plan, name: org.name });
        out.plan = body.plan;
      }
    }

    if (body.grantUsd !== undefined) {
      const usd = Number(body.grantUsd);
      if (!Number.isFinite(usd) || usd <= 0 || usd > MAX_GRANT_USD) {
        return NextResponse.json({ error: `A grant is between $0 and $${MAX_GRANT_USD}.` }, { status: 400 });
      }
      const micro = Math.round(usd * 1e6);
      const balance = await db.transaction(async (tx) => {
        await tx.insert(creditTopups).values({
          id: newId(),
          orgId: id,
          userId: gate.actor.user.id,
          amountUsd: micro,
          source: "admin",
        });
        const [row] = await tx
          .update(organizations)
          .set({ creditBalance: sql`${organizations.creditBalance} + ${micro}` })
          .where(eq(organizations.id, id))
          .returning({ b: organizations.creditBalance });
        return row?.b ?? 0;
      });
      await audit(gate.actor, "workspace.grant", { type: "workspace", id }, { usd, name: org.name, note: typeof body.note === "string" ? body.note.slice(0, 200) : undefined });
      out.balanceUsd = balance / 1e6;
    }

    if (body.suspended !== undefined) {
      if (typeof body.suspended !== "boolean") {
        return NextResponse.json({ error: "suspended must be true or false." }, { status: 400 });
      }
      const stored = org.settings && typeof org.settings === "object" ? (org.settings as Record<string, unknown>) : {};
      const next = { ...stored };
      if (body.suspended) next.suspended = true;
      else delete next.suspended;
      await db.update(organizations).set({ settings: next }).where(eq(organizations.id, id));
      await audit(gate.actor, body.suspended ? "workspace.suspend" : "workspace.restore", { type: "workspace", id }, { name: org.name, reason: typeof body.reason === "string" ? body.reason.slice(0, 200) : undefined });
      out.suspended = body.suspended;
    }

    return NextResponse.json(out);
  } catch (e) {
    return fail(e);
  }
}

/** Everything about one workspace: who is in it, what it holds, what it has been doing. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const { id } = await params;
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    const [use, members, recent, projects] = await Promise.all([
      workspaceUsage(id),
      db
        .select({ id: users.id, name: users.name, email: users.email, role: memberships.role, joinedAt: memberships.createdAt })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.orgId, id)),
      db.select().from(runs).where(eq(runs.orgId, id)).orderBy(desc(runs.createdAt)).limit(8),
      db.select({ id: graphs.id, title: graphs.title, updatedAt: graphs.updatedAt }).from(graphs).where(eq(graphs.orgId, id)).orderBy(desc(graphs.updatedAt)).limit(8),
    ]);
    return NextResponse.json({
      workspace: {
        id: org.id,
        name: org.name,
        plan: org.plan,
        billed: Boolean(org.polarSubscriptionId),
        balanceUsd: org.creditBalance / 1e6,
        suspended: isSuspended(org.settings),
        createdAt: org.createdAt,
      },
      usage: use,
      members,
      recentRuns: recent.map((r) => ({ id: r.id, status: r.status, trigger: r.trigger, costUsd: r.totalCostUsd / 1e6, error: r.error, createdAt: r.createdAt })),
      projects,
    });
  } catch (e) {
    return fail(e);
  }
}
